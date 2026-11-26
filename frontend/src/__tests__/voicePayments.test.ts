import { expect, it } from 'vitest';
import { VoicePayments } from '../lib/voice-payments';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const hash = 'b'.repeat(64);
const payees = [{ id: 'maya', name: 'Maya Chen' }];
it('lists only real organization-linked enrollments without exposing biometric metadata', () => {
  const service = new VoicePayments();
  expect(service.listOrganizationVoices('bank').totalCount).toBe(0);
  service.register('personal', 'personal-speaker', 'a'.repeat(64));
  service.register('customer', 'bank-speaker', 'b'.repeat(64), { organizationId: 'bank', customerName: 'Asha Rao', customerReference: 'CUST-001' });
  service.register('other', 'other-speaker', 'c'.repeat(64), { organizationId: 'other-bank', customerName: 'Other Customer', customerReference: 'CUST-002' });
  const result = service.listOrganizationVoices('bank');
  expect(result.totalCount).toBe(1);
  expect(result.items[0]).toMatchObject({ customerName: 'Asha Rao', customerRefMasked: 'CUST-001', source: 'live', lastVerifiedAt: '' });
  expect(JSON.stringify(result)).not.toContain('bank-speaker');
  expect(JSON.stringify(result)).not.toContain('enrollmentHash');
});
function setup() {
  const service = new VoicePayments();
  service.register('owner', 'voice-owner', 'a'.repeat(64));
  const analysis = { speaker_id: 'voice-owner', payment_checks_live: true, audio_sha256: hash,
    transcript: 'Transfer fifty rupees to Maya Chen',
    report: { speaker_status: 'match', authenticity_status: 'genuine', intent: {
      intents: ['money_transfer'], amounts: [{ value: 50, currency: 'INR' }] } },
    voice_checks: { decision: 'match', deepfake_complete: true } };
  return { service, analysis };
}

it('verifies a later login without replacing enrollment or issuing payment authorization', () => {
  const { service, analysis } = setup();
  service.linkOrganization('owner', { organizationId: 'bank', customerName: 'Asha Rao', customerReference: 'CUST-001' });
  const original = { ...service.profiles.get('owner')! };
  analysis.transcript = 'This is my fresh sign in recording';
  analysis.report.intent.amounts = [];
  service.verifyLogin('owner', analysis);
  expect(service.profiles.get('owner')).toMatchObject({ speakerId: original.speakerId, enrollmentHash: original.enrollmentHash, consentAt: original.consentAt });
  expect(service.listOrganizationVoices('bank').items[0].lastVerifiedAt).not.toBe('');
  expect(() => service.consume('owner', 'not-a-payment-token')).toThrow();
  expect(() => service.verifyLogin('owner', analysis)).toThrow('fresh');
});

it('rejects mismatched, synthetic, cached, and enrollment audio at voice sign-in', () => {
  const { service, analysis } = setup();
  expect(() => service.verifyLogin('owner', { ...analysis, speaker_id: 'other' })).toThrow();
  expect(() => service.verifyLogin('owner', { ...analysis, report: { ...analysis.report, authenticity_status: 'synthetic' } })).toThrow();
  expect(() => service.verifyLogin('owner', { ...analysis, payment_checks_live: false })).toThrow();
  expect(() => service.verifyLogin('owner', { ...analysis, audio_sha256: 'a'.repeat(64) })).toThrow();
  expect(service.isReplay('owner', analysis.audio_sha256)).toBe(false);
});

it('requires an enrolled profile and refuses to move a profile across organizations', () => {
  const service = new VoicePayments();
  const details = { organizationId: 'bank', customerName: 'Asha Rao', customerReference: 'CUST-001' };
  expect(() => service.linkOrganization('owner', details)).toThrow('Enroll');
  service.register('owner', 'speaker', 'a'.repeat(64));
  expect(service.listOrganizationVoices('bank').totalCount).toBe(0);
  service.linkOrganization('owner', details);
  expect(() => service.linkOrganization('owner', { ...details, organizationId: 'other-bank' })).toThrow('another organization');
});

it('requires enrollment and consent-backed registration before any authorization', () => {
  const { analysis } = setup();
  expect(new VoicePayments().authorize('owner', analysis, payees).eligible).toBe(false);
});
it('blocks another speaker even if the speech is genuine', () => {
  const { service, analysis } = setup(); analysis.report.speaker_status = 'no_match';
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
});
it('blocks synthetic speech even when the speaker matches', () => {
  const { service, analysis } = setup(); analysis.report.authenticity_status = 'synthetic';
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
});
it('blocks failed or missing checks and saved-only results', () => {
  const { service, analysis } = setup(); analysis.payment_checks_live = false;
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
  analysis.payment_checks_live = true; analysis.voice_checks.deepfake_complete = false;
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
});
it('issues a one-use authorization bound to account, amount, and recipient', () => {
  const { service, analysis } = setup();
  const result = service.authorize('owner', analysis, payees, 1000);
  expect(result.eligible).toBe(true);
  const token = result.authorizationToken!;
  expect(() => service.consume('other-account', token, 1001)).toThrow();
  const auth = service.consume('owner', token, 1002);
  expect(auth.amountCents).toBe(5000); expect(auth.payeeId).toBe('maya');
  expect(() => service.consume('owner', token, 1003)).toThrow();
});
it('blocks reused clips, including enrollment audio', () => {
  const { service, analysis } = setup();
  expect(service.authorize('owner', { ...analysis, audio_sha256: 'a'.repeat(64) }, payees).eligible).toBe(false);
  service.authorize('owner', analysis, payees);
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
});
it('rejects expired authorization', () => {
  const { service, analysis } = setup();
  const result = service.authorize('owner', analysis, payees, 1000);
  expect(() => service.consume('owner', result.authorizationToken!, 121001)).toThrow('expired');
});
it('rejects references to another account voice profile', () => {
  const { service, analysis } = setup(); analysis.speaker_id = 'someone-else';
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
});
it('requires an exact amount and a recognized recipient', () => {
  const { service, analysis } = setup();
  analysis.report.intent.amounts = [];
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
  analysis.report.intent.amounts = [{ value: 50, currency: 'INR' }];
  analysis.transcript = 'Transfer fifty rupees to my saved beneficiary';
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
});
it('does not permit replacing an enrolled owner', () => {
  const { service } = setup();
  expect(() => service.register('owner', 'attacker', hash)).toThrow('already enrolled');
});
it('does not authorize a negated transfer instruction', () => {
  const { service, analysis } = setup();
  analysis.transcript = 'Do not transfer fifty rupees to Maya Chen';
  expect(service.authorize('owner', analysis, payees).eligible).toBe(false);
});

it('matches a newly saved recipient despite punctuation and spacing in transcription', () => {
  const { service, analysis } = setup();
  analysis.transcript = 'Pay fifty rupees to Asha   Rao.';
  const result = service.authorize('owner', analysis, [{ id: 'new-payee', name: 'Asha-Rao' }]);
  expect(result.eligible).toBe(true);
  expect(service.consume('owner', result.authorizationToken!).payeeId).toBe('new-payee');
});

it('does not match a saved name inside another recipient name', () => {
  const { service, analysis } = setup();
  analysis.transcript = 'Pay fifty rupees to Joanna';
  expect(service.authorize('owner', analysis, [{ id: 'ann', name: 'Ann' }]).eligible).toBe(false);
});

it('blocks ambiguous normalized recipient names', () => {
  const { service, analysis } = setup();
  expect(service.authorize('owner', analysis, [
    { id: 'one', name: 'Maya Chen' }, { id: 'two', name: 'Maya-Chen' },
  ]).eligible).toBe(false);
});

it('persists the owner and replay protection across restarts without restoring payment tokens', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-payments-'));
  const file = path.join(directory, 'state.json');
  try {
    const service = new VoicePayments(file);
    service.register('owner', 'voice-owner', 'a'.repeat(64), { organizationId: 'bank', customerName: 'Asha Rao', customerReference: 'CUST-001' });
    service.recordVerifiedAudio('owner', 'retained-recording-id');
    const { analysis } = setup();
    const result = service.authorize('owner', analysis, payees);
    const restored = new VoicePayments(file);
    expect(restored.profiles.get('owner')?.speakerId).toBe('voice-owner');
    expect(restored.listOrganizationVoices('bank').items[0].customerName).toBe('Asha Rao');
    expect(restored.listOrganizationVoices('bank').items[0].recordingId).toBe('retained-recording-id');
    expect(restored.listOrganizationVoices('other-bank').totalCount).toBe(0);
    expect(restored.isReplay('owner', hash)).toBe(true);
    expect(() => restored.consume('owner', result.authorizationToken!)).toThrow();
  } finally { if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(directory); }
});
