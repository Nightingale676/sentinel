import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ClientPortalStore } from '../lib/client-portal-service';
import { VoiceRecordings } from '../lib/voice-recordings';
import { classifyRejectedVoice } from '../lib/voice-audit';
import crypto from 'node:crypto';

it('retains audio only with consent, persists it privately, and isolates organizations', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-recordings-'));
  try {
    const store = new VoiceRecordings(directory);
    expect(store.save('bank', 'dm9pY2U=', '.wav', false)).toBeUndefined();
    expect(fs.readdirSync(directory)).toHaveLength(0);
    const id = store.save('bank', 'dm9pY2U=', '.wav', true)!;
    const laterId = store.save('bank', Buffer.from('later recording').toString('base64'), '.wav', true)!;
    expect(laterId).not.toBe(id);
    const restored = new VoiceRecordings(directory);
    expect(restored.get('other-bank', id)).toBeNull();
    expect(restored.get('bank', '../index')).toBeNull();
    const recording = restored.get('bank', id)!;
    expect(recording.mimeType).toBe('audio/wav');
    expect(fs.readFileSync(recording.file, 'utf8')).toBe('voice');
    expect(fs.readFileSync(restored.get('bank', laterId)!.file, 'utf8')).toBe('later recording');
    const enrollmentHash = crypto.createHash('sha256').update('voice').digest('hex');
    expect(restored.findByHash('bank', enrollmentHash)).toBe(id);
    expect(restored.findByHash('other-bank', enrollmentHash)).toBeUndefined();
    expect(() => store.save('bank', 'dm9pY2U=', '/../.html', true)).toThrow();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

it('replaces seeded transactions with a durable live ledger and resolves one payment row', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ledger-'));
  try {
    const file = path.join(directory, 'ledger.json');
    const store = new ClientPortalStore(Date.now(), file);
    expect(store.listTransactions('org_aarohan_bank').total).toBe(0);
    const common = { organization_id: 'org_aarohan_bank', appId: 'app_mobile', customerRef: 'CUST-001',
      action: 'Voice payment attempt', amount: 50, currency: 'INR', reason: 'Review required', riskLevel: 'Medium' as const, whatHappenedNext: 'No debit.' };
    const pending = store.ingestTransaction({ ...common, status: 'Suspicious', recordingId: 'private-id', transcript: 'Pay fifty rupees' });
    store.ingestTransaction({ ...common, status: 'Blocked', reason: 'Voice mismatch.' });
    expect(store.listTransactions('org_aarohan_bank', { tab: 'suspicious' }).total).toBe(1);
    expect(store.listTransactions('org_aarohan_bank', { tab: 'blocked' }).total).toBe(1);
    expect(store.listVoiceAttempts('org_aarohan_bank', 'CUST-001')).toHaveLength(2);
    expect(store.listVoiceAttempts('org_dakshin_coop', 'CUST-001')).toHaveLength(0);
    expect(store.getSummary('org_aarohan_bank').totalValuePaise).toBe(0);
    store.resolveTransaction('org_aarohan_bank', pending.id, 'Allowed', 'Confirmed and debited.');
    const restored = new ClientPortalStore(Date.now(), file);
    expect(restored.listTransactions('org_aarohan_bank').total).toBe(2);
    expect(restored.listTransactions('org_aarohan_bank', { tab: 'suspicious' }).total).toBe(0);
    expect(restored.getSummary('org_aarohan_bank').totalValuePaise).toBe(5000);
    expect(restored.getTransactionById('org_aarohan_bank', pending.id)).toMatchObject({ status: 'Allowed', recordingId: 'private-id' });
    expect(restored.getTransactionById('org_dakshin_coop', pending.id)).toBeNull();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

it('keeps definite voice mismatches and synthetic attempts blocked even if another check is inconclusive', () => {
  expect(classifyRejectedVoice({ report: { speaker_status: 'no_match', authenticity_status: 'unknown' } })).toBe('Blocked');
  expect(classifyRejectedVoice({ report: { speaker_status: 'unknown', authenticity_status: 'synthetic' } })).toBe('Blocked');
  expect(classifyRejectedVoice({ report: { speaker_status: 'unknown', authenticity_status: 'unknown' } })).toBe('Suspicious');
  expect(classifyRejectedVoice({ error: 'Provider unavailable' })).toBe('Suspicious');
});
