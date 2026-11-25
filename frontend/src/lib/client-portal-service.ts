import crypto from 'node:crypto';
import { convertToPaise, DEFAULT_FX_RATES_TO_INR, formatInr } from './inr.ts';

export type ClientRole = 'client_admin' | 'client_viewer';
export type ClientAppType = 'mobile_app' | 'call_center' | 'assistant';
export type ClientTxStatus = 'Allowed' | 'Suspicious' | 'Blocked';
export type ClientVerificationOutcome = 'Verified' | 'Not verified';
export type ClientRiskLevel = 'Low' | 'Medium' | 'High';
export type ClientVoiceStatus = 'Active' | 'Needs re-enrollment';

export interface ClientOrganization {
  id: string;
  name: string;
  fxRates: Record<string, number>;
}

export interface StoredClientUser {
  id: string;
  organization_id: string;
  email: string;
  fullName: string;
  role: ClientRole;
  passwordSalt: string;
  passwordHash: string;
}

export interface SanitizedClientUser {
  id: string;
  organization_id: string;
  organizationName: string;
  email: string;
  fullName: string;
  role: ClientRole;
}

export interface StoredClientApp {
  id: string;
  organization_id: string;
  name: string;
  type: ClientAppType;
  status: 'Active' | 'Paused';
  keyHash: string;
  keyPrefix: string;
  lastRotatedAt: string;
  lastActiveAt: string;
}

export interface PublicClientApp {
  id: string;
  organization_id: string;
  name: string;
  type: ClientAppType;
  status: 'Active' | 'Paused';
  transactionsCount: number;
  blockedCount: number;
  lastActiveAt: string;
}

export interface StoredClientVoice {
  id: string;
  organization_id: string;
  customerRefMasked: string;
  enrolledAt: string;
  lastVerifiedAt: string;
  status: ClientVoiceStatus;
  // Embedding fingerprint stored server-side only; zero audio ever stored or exposed.
  embeddingFingerprint: string;
}

export interface PublicClientVoice {
  id: string;
  organization_id: string;
  customerRefMasked: string;
  enrolledAt: string;
  lastVerifiedAt: string;
  status: ClientVoiceStatus;
}

export interface StoredClientTransaction {
  id: string;
  organization_id: string;
  appId: string;
  appName: string;
  timestamp: string;
  customerRef: string;
  action: string;
  amountPaise: number;
  status: ClientTxStatus;
  verificationOutcome?: ClientVerificationOutcome;
  reason: string;
  riskLevel: ClientRiskLevel;
  whatHappenedNext: string;
}

interface AuditCurrencyRecord {
  transactionId: string;
  organization_id: string;
  originalCurrency: string;
  originalAmount: number;
  recordedAt: string;
}

export class ClientPortalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ClientPortalError';
    this.status = status;
  }
}

function hashWithSalt(secret: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash };
}

function verifyHash(secret: string, salt: string, expectedHash: string): boolean {
  const candidate = crypto.scryptSync(secret, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export class ClientPortalStore {
  private orgs = new Map<string, ClientOrganization>();
  private usersById = new Map<string, StoredClientUser>();
  private userIdByEmail = new Map<string, string>();
  private apps: StoredClientApp[] = [];
  private voices: StoredClientVoice[] = [];
  private transactions: StoredClientTransaction[] = [];
  // Internal audit records for original non-INR currency conversions; never returned via API.
  private auditRecords = new Map<string, AuditCurrencyRecord>();

  constructor(nowMs = Date.now()) {
    this.seed(nowMs);
  }

  private seed(nowMs: number) {
    // Primary seeded client organization
    const primaryOrgId = 'org_aarohan_bank';
    this.orgs.set(primaryOrgId, {
      id: primaryOrgId,
      name: 'Aarohan Bank India',
      fxRates: { ...DEFAULT_FX_RATES_TO_INR },
    });

    // Secondary organization to verify strict multi-tenant isolation
    const secondaryOrgId = 'org_dakshin_coop';
    this.orgs.set(secondaryOrgId, {
      id: secondaryOrgId,
      name: 'Dakshin Co-op Bank',
      fxRates: { ...DEFAULT_FX_RATES_TO_INR },
    });

    // Seeded client users (admin + viewer for primary org, plus admin for secondary org)
    const usersSeed: Array<{
      id: string;
      orgId: string;
      email: string;
      fullName: string;
      role: ClientRole;
      pass: string;
    }> = [
      {
        id: 'cusr_admin_1',
        orgId: primaryOrgId,
        email: 'admin@aarohanbank.in',
        fullName: 'Meera Nair',
        role: 'client_admin',
        pass: 'SentinelClient2026!',
      },
      {
        id: 'cusr_viewer_1',
        orgId: primaryOrgId,
        email: 'viewer@aarohanbank.in',
        fullName: 'Rohan Kulkarni',
        role: 'client_viewer',
        pass: 'SentinelViewer2026!',
      },
      {
        id: 'cusr_other_admin',
        orgId: secondaryOrgId,
        email: 'admin@dakshincu.in',
        fullName: 'Kavita Iyer',
        role: 'client_admin',
        pass: 'DakshinAdmin2026!',
      },
    ];

    for (const u of usersSeed) {
      const { salt, hash } = hashWithSalt(u.pass);
      this.usersById.set(u.id, {
        id: u.id,
        organization_id: u.orgId,
        email: u.email.toLowerCase(),
        fullName: u.fullName,
        role: u.role,
        passwordSalt: salt,
        passwordHash: hash,
      });
      this.userIdByEmail.set(u.email.toLowerCase(), u.id);
    }

    // 3 Apps for primary org + 1 App for secondary org
    const primaryApps: Array<{ id: string; name: string; type: ClientAppType; minsAgo: number }> = [
      { id: 'app_mobile', name: 'Aarohan Mobile', type: 'mobile_app', minsAgo: 4 },
      { id: 'app_call', name: 'Aarohan Call Desk', type: 'call_center', minsAgo: 11 },
      { id: 'app_assistant', name: 'Aarohan Voice Assistant', type: 'assistant', minsAgo: 19 },
    ];

    for (const a of primaryApps) {
      this.apps.push({
        id: a.id,
        organization_id: primaryOrgId,
        name: a.name,
        type: a.type,
        status: 'Active',
        keyHash: sha256Hex(`seed-only-hash-${a.id}`),
        keyPrefix: `snt_${a.id.slice(4, 8)}`,
        lastRotatedAt: new Date(nowMs - 1000 * 60 * 60 * 24 * 18).toISOString(),
        lastActiveAt: new Date(nowMs - 1000 * 60 * a.minsAgo).toISOString(),
      });
    }

    this.apps.push({
      id: 'app_dakshin_mobile',
      organization_id: secondaryOrgId,
      name: 'Dakshin Mobile',
      type: 'mobile_app',
      status: 'Active',
      keyHash: sha256Hex('seed-only-hash-dakshin'),
      keyPrefix: 'snt_daks',
      lastRotatedAt: new Date(nowMs - 1000 * 60 * 60 * 24 * 10).toISOString(),
      lastActiveAt: new Date(nowMs - 1000 * 60 * 35).toISOString(),
    });

    // 40 Voice profiles for primary org + 2 for secondary org (embeddings only)
    for (let i = 0; i < 40; i++) {
      const refNum = 1040 + i * 7;
      const enrolledDaysAgo = 95 - (i % 70);
      const lastVerifiedHoursAgo = 2 + ((i * 13) % 480);
      const needsReenroll = i % 9 === 4;
      this.voices.push({
        id: `vc_${100 + i}`,
        organization_id: primaryOrgId,
        customerRefMasked: `ABIN-••••-${refNum}`,
        enrolledAt: new Date(nowMs - enrolledDaysAgo * 86_400_000).toISOString(),
        lastVerifiedAt: new Date(nowMs - lastVerifiedHoursAgo * 3_600_000).toISOString(),
        status: needsReenroll ? 'Needs re-enrollment' : 'Active',
        embeddingFingerprint: sha256Hex(`emb-${primaryOrgId}-${i}`),
      });
    }

    this.voices.push({
      id: 'vc_other_1',
      organization_id: secondaryOrgId,
      customerRefMasked: 'DAKS-••••-9901',
      enrolledAt: new Date(nowMs - 20 * 86_400_000).toISOString(),
      lastVerifiedAt: new Date(nowMs - 4 * 3_600_000).toISOString(),
      status: 'Active',
      embeddingFingerprint: sha256Hex(`emb-${secondaryOrgId}-1`),
    });

    // ~200 INR transactions across 90 days for primary org
    const actionTemplates = [
      { action: 'UPI Transfer', amountInr: 18500 },
      { action: 'NEFT Payee Transfer', amountInr: 125000 },
      { action: 'IMPS Instant Transfer', amountInr: 48000 },
      { action: 'RTGS High-Value Wire', amountInr: 450000 },
      { action: 'Utility Bill Payment', amountInr: 6420 },
      { action: 'Card Limit Change', amountInr: 150000 },
      { action: 'Beneficiary Addition', amountInr: 75000 },
      { action: 'SIM / Phone Update', amountInr: 0 },
    ];

    const allowReasons = [
      'Natural voice matched enrolled profile on registered mobile device.',
      'Consistent vocal cadence and familiar recurring payee within daily INR limit.',
      'Matched speaker embedding and trusted call center session.',
    ];
    const suspiciousReasons = [
      'Transfer above ₹50,000 threshold from a new device location.',
      'High-value payment to an unverified beneficiary requested by voice.',
      'Voice check held for personal passphrase confirmation.',
    ];
    const blockReasons = [
      'Synthetic speech markers detected during live call screening.',
      'Audio replay signature detected without trusted device presence.',
      'Voice cadence mismatch paired with urgent beneficiary change.',
    ];

    for (let i = 0; i < 204; i++) {
      // Deterministic distribution across 0..89 days (heavier in recent 7 and 30 days)
      const dayOffset =
        i < 46
          ? i % 7
          : i < 118
          ? 7 + (i % 23)
          : 30 + (i % 60);
      const minuteOffset = (i * 37) % 1380;
      const ts = new Date(nowMs - dayOffset * 86_400_000 - minuteOffset * 60_000).toISOString();

      const appMeta = primaryApps[i % primaryApps.length];
      const tpl = actionTemplates[i % actionTemplates.length];
      const mod = i % 17;

      let status: ClientTxStatus = 'Allowed';
      let verificationOutcome: ClientVerificationOutcome | undefined;
      let reason = allowReasons[i % allowReasons.length];
      let riskLevel: ClientRiskLevel = 'Low';
      let whatHappenedNext = 'Transfer cleared immediately under standard policy.';

      if (mod === 2 || mod === 9 || mod === 15) {
        status = 'Blocked';
        reason = blockReasons[i % blockReasons.length];
        riskLevel = 'High';
        whatHappenedNext =
          'Stopped by Sentinel before reaching core banking. Customer notified via SMS.';
      } else if (mod === 4 || mod === 11 || mod === 14) {
        status = 'Suspicious';
        const verified = i % 2 === 0;
        verificationOutcome = verified ? 'Verified' : 'Not verified';
        reason = suspiciousReasons[i % suspiciousReasons.length];
        riskLevel = 'Medium';
        whatHappenedNext = verified
          ? 'Customer confirmed personal passphrase; request completed safely.'
          : 'Challenged with extra passphrase prompt; customer did not complete verification.';
      }

      const variance = ((i % 9) + 1) * 1250;
      const inrRupees = tpl.amountInr === 0 ? 0 : tpl.amountInr + variance;
      // Convert one sample record via FX entry path to validate audit isolation internally
      const converted =
        i === 5
          ? convertToPaise(2500, 'USD', DEFAULT_FX_RATES_TO_INR)
          : convertToPaise(inrRupees, 'INR', DEFAULT_FX_RATES_TO_INR);

      const txId = `ctx_${1000 + i}`;
      this.transactions.push({
        id: txId,
        organization_id: primaryOrgId,
        appId: appMeta.id,
        appName: appMeta.name,
        timestamp: ts,
        customerRef: `ABIN-••••-${1040 + (i % 40) * 7}`,
        action: tpl.action,
        amountPaise: converted.amountPaise,
        status,
        verificationOutcome,
        reason,
        riskLevel,
        whatHappenedNext,
      });

      if (converted.auditOriginalCurrency !== 'INR') {
        this.auditRecords.set(txId, {
          transactionId: txId,
          organization_id: primaryOrgId,
          originalCurrency: converted.auditOriginalCurrency,
          originalAmount: converted.auditOriginalAmount,
          recordedAt: ts,
        });
      }
    }

    // Seed 3 isolated transactions for Dakshin Co-op Bank (never visible to Aarohan Bank)
    this.transactions.push({
      id: 'ctx_dakshin_1',
      organization_id: secondaryOrgId,
      appId: 'app_dakshin_mobile',
      appName: 'Dakshin Mobile',
      timestamp: new Date(nowMs - 3_600_000).toISOString(),
      customerRef: 'DAKS-••••-9901',
      action: 'IMPS Instant Transfer',
      amountPaise: 9500000,
      status: 'Blocked',
      reason: 'Synthetic audio replay stopped.',
      riskLevel: 'High',
      whatHappenedNext: 'Blocked before transfer.',
    });

    this.transactions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  authenticate(email: string, password: string): SanitizedClientUser | null {
    const id = this.userIdByEmail.get(String(email ?? '').trim().toLowerCase());
    if (!id) return null;
    const user = this.usersById.get(id);
    if (!user || !verifyHash(password, user.passwordSalt, user.passwordHash)) {
      return null;
    }
    return this.sanitizeUser(user);
  }

  getUserById(userId: string): SanitizedClientUser | null {
    const u = this.usersById.get(userId);
    return u ? this.sanitizeUser(u) : null;
  }

  private sanitizeUser(u: StoredClientUser): SanitizedClientUser {
    const org = this.orgs.get(u.organization_id);
    return {
      id: u.id,
      organization_id: u.organization_id,
      organizationName: org?.name ?? 'Client Organization',
      email: u.email,
      fullName: u.fullName,
      role: u.role,
    };
  }

  /**
   * Ingest a transaction (supports foreign currency conversion on entry to integer INR paise).
   */
  ingestTransaction(input: {
    organization_id: string;
    appId: string;
    customerRef: string;
    action: string;
    amount: number;
    currency: string;
    status: ClientTxStatus;
    verificationOutcome?: ClientVerificationOutcome;
    reason: string;
    riskLevel: ClientRiskLevel;
    whatHappenedNext: string;
    timestamp?: string;
  }): StoredClientTransaction {
    const org = this.orgs.get(input.organization_id);
    if (!org) throw new ClientPortalError('Organization not found.', 404);
    const app = this.apps.find(
      (a) => a.id === input.appId && a.organization_id === input.organization_id
    );
    if (!app) throw new ClientPortalError('App not found in organization.', 404);

    const converted = convertToPaise(input.amount, input.currency, org.fxRates);
    const id = `ctx_${crypto.randomUUID().slice(0, 8)}`;
    const ts = input.timestamp ?? new Date().toISOString();

    const tx: StoredClientTransaction = {
      id,
      organization_id: input.organization_id,
      appId: app.id,
      appName: app.name,
      timestamp: ts,
      customerRef: input.customerRef,
      action: input.action,
      amountPaise: converted.amountPaise,
      status: input.status,
      verificationOutcome: input.status === 'Suspicious' ? input.verificationOutcome ?? 'Not verified' : undefined,
      reason: input.reason,
      riskLevel: input.riskLevel,
      whatHappenedNext: input.whatHappenedNext,
    };

    this.transactions.unshift(tx);

    if (converted.auditOriginalCurrency !== 'INR') {
      this.auditRecords.set(id, {
        transactionId: id,
        organization_id: input.organization_id,
        originalCurrency: converted.auditOriginalCurrency,
        originalAmount: converted.auditOriginalAmount,
        recordedAt: ts,
      });
    }

    return tx;
  }

  getAuditRecordForInternalCheck(txId: string): AuditCurrencyRecord | undefined {
    return this.auditRecords.get(txId);
  }

  getSummary(orgId: string, days: 7 | 30 | 90 = 30, nowMs = Date.now()) {
    const org = this.orgs.get(orgId);
    if (!org) throw new ClientPortalError('Organization not found.', 404);

    const cutoffMs = nowMs - days * 86_400_000;
    const scoped = this.transactions.filter(
      (t) => t.organization_id === orgId && new Date(t.timestamp).getTime() >= cutoffMs
    );

    let totalValuePaise = 0;
    let blockedCount = 0;
    let suspiciousCount = 0;

    // Build daily buckets
    const dailyMap = new Map<string, { date: string; total: number; blocked: number }>();
    for (let d = days - 1; d >= 0; d--) {
      const dateStr = new Date(nowMs - d * 86_400_000).toISOString().slice(0, 10);
      dailyMap.set(dateStr, { date: dateStr, total: 0, blocked: 0 });
    }

    for (const t of scoped) {
      totalValuePaise += t.amountPaise;
      if (t.status === 'Blocked') blockedCount += 1;
      if (t.status === 'Suspicious') suspiciousCount += 1;

      const dayKey = t.timestamp.slice(0, 10);
      const bucket = dailyMap.get(dayKey);
      if (bucket) {
        bucket.total += 1;
        if (t.status === 'Blocked') bucket.blocked += 1;
      }
    }

    const latestBlocked = scoped.filter((t) => t.status === 'Blocked').slice(0, 5);
    const latestSuspicious = scoped.filter((t) => t.status === 'Suspicious').slice(0, 5);

    return {
      organizationName: org.name,
      days,
      totalTransactions: scoped.length,
      totalValuePaise,
      blockedCount,
      suspiciousCount,
      dailySeries: Array.from(dailyMap.values()),
      latestBlocked,
      latestSuspicious,
    };
  }

  listTransactions(
    orgId: string,
    opts: {
      tab?: 'all' | 'suspicious' | 'blocked';
      q?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const tab = opts.tab ?? 'all';
    const q = String(opts.q ?? '').trim().toLowerCase();
    const fromMs = opts.from ? new Date(`${opts.from}T00:00:00.000Z`).getTime() : null;
    const toMs = opts.to ? new Date(`${opts.to}T23:59:59.999Z`).getTime() : null;
    const page = Math.max(1, Number(opts.page ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(opts.limit ?? 15) || 15));

    const filtered = this.transactions.filter((t) => {
      if (t.organization_id !== orgId) return false;
      if (tab === 'suspicious' && t.status !== 'Suspicious') return false;
      if (tab === 'blocked' && t.status !== 'Blocked') return false;

      const tsMs = new Date(t.timestamp).getTime();
      if (fromMs !== null && Number.isFinite(fromMs) && tsMs < fromMs) return false;
      if (toMs !== null && Number.isFinite(toMs) && tsMs > toMs) return false;

      if (q) {
        const haystack = `${t.appName} ${t.customerRef} ${t.action} ${t.reason} ${t.status} ${formatInr(t.amountPaise)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      items: filtered.slice(start, start + limit),
      total,
      page: safePage,
      limit,
      totalPages,
    };
  }

  getTransactionById(orgId: string, txId: string): StoredClientTransaction | null {
    const found = this.transactions.find(
      (t) => t.id === txId && t.organization_id === orgId
    );
    return found ?? null;
  }

  listVoices(orgId: string): { totalCount: number; items: PublicClientVoice[] } {
    const scoped = this.voices
      .filter((v) => v.organization_id === orgId)
      .map((v) => ({
        id: v.id,
        organization_id: v.organization_id,
        customerRefMasked: v.customerRefMasked,
        enrolledAt: v.enrolledAt,
        lastVerifiedAt: v.lastVerifiedAt,
        status: v.status,
      }));
    return {
      totalCount: scoped.length,
      items: scoped,
    };
  }

  requestVoiceReenroll(orgId: string, role: ClientRole, voiceId: string): PublicClientVoice {
    if (role !== 'client_admin') {
      throw new ClientPortalError('Only a client admin can request voice re-enrollment.', 403);
    }
    const voice = this.voices.find(
      (v) => v.id === voiceId && v.organization_id === orgId
    );
    if (!voice) {
      throw new ClientPortalError('Voice profile not found.', 404);
    }
    voice.status = 'Needs re-enrollment';
    return {
      id: voice.id,
      organization_id: voice.organization_id,
      customerRefMasked: voice.customerRefMasked,
      enrolledAt: voice.enrolledAt,
      lastVerifiedAt: voice.lastVerifiedAt,
      status: voice.status,
    };
  }

  deleteVoice(orgId: string, role: ClientRole, voiceId: string): { deletedId: string } {
    if (role !== 'client_admin') {
      throw new ClientPortalError('Only a client admin can delete a voiceprint.', 403);
    }
    const idx = this.voices.findIndex(
      (v) => v.id === voiceId && v.organization_id === orgId
    );
    if (idx === -1) {
      throw new ClientPortalError('Voice profile not found.', 404);
    }
    this.voices.splice(idx, 1);
    return { deletedId: voiceId };
  }

  listApps(orgId: string): PublicClientApp[] {
    const scopedApps = this.apps.filter((a) => a.organization_id === orgId);
    return scopedApps.map((app) => {
      const appTx = this.transactions.filter(
        (t) => t.organization_id === orgId && t.appId === app.id
      );
      const blocked = appTx.filter((t) => t.status === 'Blocked').length;
      return {
        id: app.id,
        organization_id: app.organization_id,
        name: app.name,
        type: app.type,
        status: app.status,
        transactionsCount: appTx.length,
        blockedCount: blocked,
        lastActiveAt: app.lastActiveAt,
      };
    });
  }

  rotateAppKey(
    orgId: string,
    role: ClientRole,
    appId: string
  ): { appId: string; appName: string; apiKeyOnce: string; rotatedAt: string } {
    if (role !== 'client_admin') {
      throw new ClientPortalError('Only a client admin can rotate API keys.', 403);
    }
    const app = this.apps.find(
      (a) => a.id === appId && a.organization_id === orgId
    );
    if (!app) {
      throw new ClientPortalError('App not found.', 404);
    }
    const rawKey = `snt_live_${crypto.randomBytes(20).toString('hex')}`;
    const rotatedAt = new Date().toISOString();
    app.keyHash = sha256Hex(rawKey);
    app.keyPrefix = rawKey.slice(0, 12);
    app.lastRotatedAt = rotatedAt;
    // Key is returned once only and never retained in plaintext
    return {
      appId: app.id,
      appName: app.name,
      apiKeyOnce: rawKey,
      rotatedAt,
    };
  }
}
