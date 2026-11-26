import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type EnrollmentDetails = { organizationId: string; customerName: string; customerReference: string };
type Profile = { speakerId: string; enrollmentHash: string; consentAt: number; enrollment?: EnrollmentDetails; lastVerifiedAt?: number; recordingId?: string };
type Authorization = { userId: string; speakerId: string; amountCents: number; payeeId: string; payeeName: string; expires: number };
type Payee = { id: string; name: string };
type PaymentDecision = { eligible: boolean; message: string; authorizationToken?: string; amountCents?: number; payeeName?: string };

function normalizeRecipient(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Server-owned state. Neither a browser verdict nor a passphrase authorizes a debit. */
export class VoicePayments {
  profiles = new Map<string, Profile>();
  private pending = new Map<string, Authorization>();
  private usedAudio = new Set<string>();
  constructor(private storagePath?: string) {
    if (storagePath && fs.existsSync(storagePath)) {
      const saved = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
      if (!Array.isArray(saved.profiles) || !Array.isArray(saved.usedAudio)) throw new Error('Voice payment state is invalid. Payments cannot start.');
      this.profiles = new Map(saved.profiles);
      this.usedAudio = new Set(saved.usedAudio);
    }
  }
  private persist() {
    if (!this.storagePath) return;
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    const temporary = this.storagePath + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify({ profiles: [...this.profiles], usedAudio: [...this.usedAudio] }), { mode: 0o600 });
    fs.renameSync(temporary, this.storagePath);
  }

  register(userId: string, speakerId: string, hash: string, enrollment?: EnrollmentDetails, recordingId?: string) {
    if (this.profiles.has(userId)) throw new Error('A voice owner is already enrolled. Replacing an owner is disabled.');
    this.profiles.set(userId, { speakerId, enrollmentHash: hash, consentAt: Date.now(), ...(enrollment ? { enrollment } : {}), ...(recordingId ? { recordingId } : {}) });
    try { this.persist(); }
    catch (error) { this.profiles.delete(userId); throw error; }
  }

  listOrganizationVoices(organizationId: string) {
    const items = [...this.profiles.entries()]
      .filter(([, profile]) => profile.enrollment?.organizationId === organizationId)
      .map(([id, profile]) => ({ id, organization_id: organizationId,
        customerName: profile.enrollment!.customerName, recordingId: profile.recordingId,
        customerRefMasked: profile.enrollment!.customerReference,
        enrolledAt: new Date(profile.consentAt).toISOString(), lastVerifiedAt: profile.lastVerifiedAt ? new Date(profile.lastVerifiedAt).toISOString() : '',
        status: 'Active' as const, source: 'live' as const }));
    return { totalCount: items.length, items };
  }

  linkOrganization(userId: string, enrollment: EnrollmentDetails) {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error('Enroll your voice first.');
    if (profile.enrollment && profile.enrollment.organizationId !== enrollment.organizationId) throw new Error('This profile already belongs to another organization.');
    const previous = profile.enrollment;
    profile.enrollment = enrollment;
    try { this.persist(); } catch (error) { profile.enrollment = previous; throw error; }
  }

  recordVerifiedAudio(userId: string, recordingId?: string) {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error('Voice profile not found.');
    const previous = { lastVerifiedAt: profile.lastVerifiedAt, recordingId: profile.recordingId };
    profile.lastVerifiedAt = Date.now();
    if (recordingId) profile.recordingId = recordingId;
    try { this.persist(); } catch (error) { Object.assign(profile, previous); throw error; }
  }

  verifyLogin(userId: string, analysis: any) {
    const profile = this.profiles.get(userId);
    if (!profile || analysis.speaker_id !== profile.speakerId || analysis.payment_checks_live !== true ||
        analysis.report?.speaker_status !== 'match' || analysis.report?.authenticity_status !== 'genuine' ||
        analysis.voice_checks?.deepfake_complete !== true || analysis.voice_checks?.decision !== 'match')
      throw new Error('Voice sign-in failed. A genuine recording matching the enrolled owner is required.');
    const hash = analysis.audio_sha256;
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash) || this.isReplay(userId, hash))
      throw new Error('Record a fresh voice sample. Enrollment audio and previously verified recordings cannot be reused.');
    const previous = profile.lastVerifiedAt;
    this.usedAudio.add(userId + ':' + hash);
    profile.lastVerifiedAt = Date.now();
    try { this.persist(); } catch (error) { profile.lastVerifiedAt = previous; this.usedAudio.delete(userId + ':' + hash); throw error; }
  }

  isReplay(userId: string, hash: string) {
    return this.profiles.get(userId)?.enrollmentHash === hash || this.usedAudio.has(userId + ':' + hash);
  }

  authorize(userId: string, analysis: any, payees: Payee[], now = Date.now()): PaymentDecision {
    const deny = (message: string) => ({ eligible: false, message });
    const profile = this.profiles.get(userId);
    if (!profile) return deny('Payment blocked: enroll your voice and give consent first.');
    if (analysis.speaker_id !== profile.speakerId || analysis.payment_checks_live !== true)
      return deny('Payment blocked: fresh live voice checks are required.');
    if (analysis.report?.speaker_status !== 'match')
      return deny('Payment blocked: this voice does not verify as the enrolled owner. Possible unauthorized request.');
    if (analysis.report?.authenticity_status !== 'genuine' || analysis.voice_checks?.deepfake_complete !== true || analysis.voice_checks?.decision !== 'match')
      return deny('Payment blocked: speech authenticity could not be verified.');
    const hash = analysis.audio_sha256;
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash) || this.isReplay(userId, hash))
      return deny('Payment blocked: use a new recording, not enrollment audio or a previously authorized clip.');
    const intent = analysis.report?.intent;
    if (!intent?.intents?.includes('money_transfer') || intent.intents.includes('security_code_reference') || intent.intents.includes('movement_instruction'))
      return deny('Payment blocked: the request is unclear or contains other sensitive instructions.');
    const amounts = intent.amounts;
    if (!Array.isArray(amounts) || amounts.length !== 1 || amounts[0].currency !== 'INR')
      return deny('Payment blocked: say one exact amount in rupees.');
    const amount = amounts[0].value;
    const cents = Math.round(amount * 100);
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || cents <= 0 || !Number.isSafeInteger(cents))
      return deny('Payment blocked: invalid amount.');
    const spoken = String(analysis.transcript).toLowerCase();
    if (/\b(?:not|never|cancel|stop|don't|do not|example|pretend)\b/.test(spoken))
      return deny('Payment blocked: the instruction may be negated, canceled, or quoted. Record a clear new request.');
    const recipientText = ` ${normalizeRecipient(spoken)} `;
    const recipients = payees.filter(p => {
      const name = normalizeRecipient(p.name);
      return name.length > 0 && recipientText.includes(` ${name} `);
    });
    if (recipients.length !== 1) return deny('Payment blocked: say the full name of exactly one saved payee.');
    const token = crypto.randomUUID();
    const auth = { userId, speakerId: profile.speakerId, amountCents: cents,
      payeeId: recipients[0].id, payeeName: recipients[0].name, expires: now + 120_000 };
    this.usedAudio.add(userId + ':' + hash);
    try { this.persist(); }
    catch { return deny('Payment blocked: could not save replay protection.'); }
    this.pending.set(token, auth);
    return { eligible: true, message: 'Owner voice and speech checks passed. Review the amount and payee, then confirm.',
      authorizationToken: token, amountCents: cents, payeeName: auth.payeeName };
  }

  consume(userId: string, token: string, now = Date.now()) {
    const auth = this.pending.get(token);
    if (!auth || auth.userId !== userId) throw new Error('Payment blocked: no verified voice authorization for this account.');
    this.pending.delete(token);
    if (auth.expires < now || this.profiles.get(userId)?.speakerId !== auth.speakerId)
      throw new Error('Voice authorization expired. Record a fresh request.');
    return auth;
  }
}
