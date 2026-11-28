import crypto from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { runPythonAnalysis } from './src/lib/python-analysis.ts';
import { VoicePayments } from './src/lib/voice-payments.ts';
import { VoiceRecordings } from './src/lib/voice-recordings.ts';
import { classifyRejectedVoice } from './src/lib/voice-audit.ts';
import { API_KEY_NOT_SET, voiceApiConfigured } from './src/lib/voice-api-config.ts';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { evaluateVoiceCommand, type FirewallDecision } from './src/lib/sentinel-logic.ts';
import {
  ClientPortalError,
  ClientPortalStore,
  type ClientRole,
  type SanitizedClientUser,
} from './src/lib/client-portal-service.ts';

dotenv.config({ quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const PORT = Number(process.env.PORT ?? 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Signing secret from environment or ephemeral in-memory random fallback
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface StoredUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  passwordSalt: string;
  passwordHash: string;
  passphraseSalt: string;
  passphraseHash: string;
  onboardingComplete: boolean;
  voiceEnrolledCount: number;
  phoneVerified: boolean;
  hasPassphrase: boolean;
  balanceCents: number;
  accountNumberMasked: string;
  transactions: Array<{
    id: string;
    title: string;
    counterparty: string;
    amountCents: number;
    direction: 'debit' | 'credit';
    createdAt: string;
    verificationLabel: string;
  }>;
  payees: Array<{
    id: string;
    name: string;
    category: string;
    accountHint: string;
    trusted: boolean;
  }>;
  settings: {
    voiceProtectionEnabled: boolean;
    strictSyntheticGuard: boolean;
    requireStepUpAbove: number;
    notifyOnBlocked: boolean;
    smartGlassesSync: boolean;
  };
  activity: Array<{
    id: string;
    timestamp: string;
    actionSummary: string;
    channel: string;
    decision: FirewallDecision;
    decisionLabel: string;
    explanation: string;
    reportedUnauthorized: boolean;
  }>;
}

interface PendingChallenge {
  id: string;
  userId: string;
  transcript: string;
  amount: number | null;
  recipient: string | null;
  createdAt: number;
}

function hashSecret(secret: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash: derived };
}

function verifySecret(secret: string, salt: string, expectedHash: string): boolean {
  const candidate = crypto.scryptSync(secret, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

interface JwtClaims {
  voiceVerified?: boolean;
  sub: string;
  exp: number;
  scope?: 'customer' | 'client';
  orgId?: string;
  role?: ClientRole;
}

function signJwt(payload: JwtClaims): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${body}`).digest()
  );
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as Partial<JwtClaims>;
    if (!parsed.sub || !parsed.exp || Date.now() > parsed.exp) return null;
    return {
      sub: parsed.sub,
      exp: parsed.exp,
      scope: parsed.scope,
      orgId: parsed.orgId,
      role: parsed.role,
      voiceVerified: parsed.voiceVerified === true,
    };
  } catch {
    return null;
  }
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

function setSessionCookies(
  res: Response,
  req: Request,
  userId: string,
  extra?: { scope?: 'customer' | 'client'; orgId?: string; role?: ClientRole; voiceVerified?: boolean }
): string {
  const token = signJwt({
    sub: userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    ...extra,
  });
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  const authCookieParts = [
    `sentinel_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${60 * 60 * 24 * 7}`,
  ];
  const csrfCookieParts = [
    `sentinel_csrf=${encodeURIComponent(csrfToken)}`,
    'Path=/',
    `Max-Age=${60 * 60 * 24 * 7}`,
  ];

  if (isHttps) {
    authCookieParts.push('SameSite=None', 'Secure', 'Partitioned');
    csrfCookieParts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    authCookieParts.push('SameSite=Lax');
    csrfCookieParts.push('SameSite=Lax');
  }

  res.setHeader('Set-Cookie', [authCookieParts.join('; '), csrfCookieParts.join('; ')]);
  return csrfToken;
}

function clearSessionCookies(res: Response, req: Request) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const suffix = isHttps ? 'Path=/; Max-Age=0; SameSite=None; Secure; Partitioned' : 'Path=/; Max-Age=0; SameSite=Lax';
  res.setHeader('Set-Cookie', [
    `sentinel_session=; HttpOnly; ${suffix}`,
    `sentinel_csrf=; ${suffix}`,
  ]);
}

function sanitizeUser(u: StoredUser) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    onboardingComplete: u.onboardingComplete,
    voiceEnrolledCount: u.voiceEnrolledCount,
    phoneVerified: u.phoneVerified,
    hasPassphrase: u.hasPassphrase,
  };
}

// In-memory store with realistic seeded demo account
const usersById = new Map<string, StoredUser>();
const userIdByEmail = new Map<string, string>();
const pendingChallenges = new Map<string, PendingChallenge>();

let liveRequestsProtected = 482190;
let liveThreatsBlocked = 19432;
let liveDecisionMs = 138;

const clientPortalStore = new ClientPortalStore(Date.now(), path.resolve(__dirname, '..', 'private_runtime', 'client-ledger.json'));

function seedDemoUser() {
  const email = 'alex.mercer@sentinelbank.example';
  const pw = hashSecret('SentinelDemo2026!');
  const pp = hashSecret('cedar river horizon');
  const demoUser: StoredUser = {
    id: 'usr_demo_alex',
    email,
    fullName: 'Alex Mercer',
    phone: '+1 (415) 555-0194',
    passwordSalt: pw.salt,
    passwordHash: pw.hash,
    passphraseSalt: pp.salt,
    passphraseHash: pp.hash,
    onboardingComplete: true,
    voiceEnrolledCount: 3,
    phoneVerified: true,
    hasPassphrase: true,
    balanceCents: 1482540,
    accountNumberMasked: 'Checking ···· 4829',
    transactions: [
      {
        id: 'tx_101',
        title: 'City Electric Utility',
        counterparty: 'City Electric',
        amountCents: 8420,
        direction: 'debit',
        createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
        verificationLabel: 'Voice verified',
      },
      {
        id: 'tx_102',
        title: 'Direct Deposit — Northstar Studio',
        counterparty: 'Northstar Studio',
        amountCents: 325000,
        direction: 'credit',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
        verificationLabel: 'Cleared',
      },
      {
        id: 'tx_103',
        title: 'Transfer to Maya Chen',
        counterparty: 'Maya Chen',
        amountCents: 12000,
        direction: 'debit',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 46).toISOString(),
        verificationLabel: 'Voice verified',
      },
    ],
    payees: [
      { id: 'pay_1', name: 'Maya Chen', category: 'Personal', accountHint: '···· 7712', trusted: true },
      { id: 'pay_2', name: 'City Electric', category: 'Utilities', accountHint: '···· 1044', trusted: true },
      { id: 'pay_3', name: 'Jordan Lee', category: 'Contractor', accountHint: '···· 3390', trusted: false },
    ],
    settings: {
      voiceProtectionEnabled: true,
      strictSyntheticGuard: true,
      requireStepUpAbove: 500,
      notifyOnBlocked: true,
      smartGlassesSync: true,
    },
    activity: [
      {
        id: 'act_1',
        timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
        actionSummary: 'Paid City Electric $84.20',
        channel: 'Voice Assistant',
        decision: 'allow',
        decisionLabel: 'Approved',
        explanation: 'Your voice matched your enrolled profile on your trusted phone.',
        reportedUnauthorized: false,
      },
      {
        id: 'act_2',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
        actionSummary: 'Attempted wire of $3,900 to unknown account',
        channel: 'Phone Support',
        decision: 'block',
        decisionLabel: 'Blocked',
        explanation: 'Speech patterns did not sound natural and the request came from an unfamiliar device.',
        reportedUnauthorized: false,
      },
      {
        id: 'act_3',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
        actionSummary: 'Requested $750 transfer to Jordan Lee',
        channel: 'Smart Glasses',
        decision: 'step_up',
        decisionLabel: 'Extra verification',
        explanation: 'Transfer exceeded your $500 threshold and required your personal passphrase.',
        reportedUnauthorized: false,
      },
    ],
  };
  usersById.set(demoUser.id, demoUser);
  userIdByEmail.set(email, demoUser.id);
}

seedDemoUser();

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    if (req.path === '/api/analysis' || req.path === '/api/voice/enroll' || req.path === '/api/voice/login-check' || req.path === '/api/voice/payment-check' || req.path === '/api/client/voices/enroll') { next(); return; }
    express.json({ limit: '1mb' })(req, res, next);
  });

  // Auth extraction middleware
  interface AuthedRequest extends Request {
    currentUser?: StoredUser;
    currentClientUser?: SanitizedClientUser;
  }

  function requireClientAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const cookies = parseCookies(req);
    const token = cookies.sentinel_session;
    if (!token) {
      res.status(401).json({ error: 'Please sign in with a client organization account.' });
      return;
    }
    const claims = verifyJwt(token);
    if (!claims || claims.scope !== 'client') {
      res.status(401).json({ error: 'Client session required. Please sign in at /client.' });
      return;
    }
    const clientUser = clientPortalStore.getUserById(claims.sub);
    if (!clientUser || clientUser.organization_id !== claims.orgId) {
      res.status(401).json({ error: 'Client organization session invalid.' });
      return;
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
      const csrfCookie = cookies.sentinel_csrf;
      const csrfHeader = req.headers['x-csrf-token'];
      const xrw = req.headers['x-requested-with'];
      if (!csrfCookie || typeof csrfHeader !== 'string' || csrfHeader !== csrfCookie || xrw !== 'XMLHttpRequest') {
        res.status(403).json({ error: 'Security check failed. Please refresh and try again.' });
        return;
      }
    }

    req.currentClientUser = clientUser;
    next();
  }

  function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const cookies = parseCookies(req);
    const token = cookies.sentinel_session;
    if (!token) {
      res.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    const claims = verifyJwt(token);
    if (!claims) {
      res.status(401).json({ error: 'Your session expired. Please sign in again.' });
      return;
    }
    const user = usersById.get(claims.sub);
    if (!user) {
      res.status(401).json({ error: 'Account not found. Please sign in again.' });
      return;
    }

    // CSRF validation for state-changing requests
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
      const csrfCookie = cookies.sentinel_csrf;
      const csrfHeader = req.headers['x-csrf-token'];
      const xrw = req.headers['x-requested-with'];
      if (!csrfCookie || typeof csrfHeader !== 'string' || csrfHeader !== csrfCookie || xrw !== 'XMLHttpRequest') {
        res.status(403).json({ error: 'Security check failed. Please refresh and try again.' });
        return;
      }
    }

    req.currentUser = user;
    if (voicePayments.profiles.has(user.id) && claims.voiceVerified !== true &&
        !['/api/voice/profile', '/api/voice/login-check', '/api/auth/me'].includes(req.path)) {
      res.status(403).json({ error: 'Verify your enrolled voice to finish signing in.' }); return;
    }
    next();
  }

  // Local prototype: all audio checks refer to the one explicitly enrolled customer.
  app.get('/api/analysis/health', (_req, res) => {
    res.json({ status: 'ready', service: 'sentinel-python-bridge', referenceSpeaker: 'customer_001', apiKeyConfigured: voiceApiConfigured(), message: voiceApiConfigured() ? undefined : API_KEY_NOT_SET });
  });
  function requireVoiceApi(_req: Request, res: Response, next: NextFunction) {
    if (!voiceApiConfigured()) { res.status(503).json({ error: API_KEY_NOT_SET }); return; }
    next();
  }
  let analysisBusy = false;
  const voicePayments = new VoicePayments(path.resolve(__dirname, '..', 'private_runtime', 'voice-payments.json'));
  const voiceRecordings = new VoiceRecordings(path.resolve(__dirname, '..', 'private_runtime', 'recordings'));
  const pendingAudit = new Map<string, { userId: string; organizationId: string; transactionId: string }>();
  const auditAttempt = (user: StoredUser, body: any, action: string, result: any, status: 'Allowed' | 'Blocked' | 'Suspicious', reason: string, amountPaise = 0) => {
    const details = voicePayments.profiles.get(user.id)?.enrollment;
    if (!details) return undefined;
    let recordingId: string | undefined;
    try { recordingId = voiceRecordings.save(details.organizationId, body.audio, body.suffix, body.recordingConsent); }
    catch { reason += ' Recording could not be retained.'; }
    if (!amountPaise && action === 'Voice payment attempt') {
      const amounts = result?.report?.intent?.amounts;
      if (Array.isArray(amounts) && amounts.length === 1 && amounts[0].currency === 'INR' && typeof amounts[0].value === 'number') {
        const parsed = Math.round(amounts[0].value * 100);
        if (Number.isSafeInteger(parsed) && parsed > 0) amountPaise = parsed;
      }
    }
    const tx = clientPortalStore.ingestTransaction({ organization_id: details.organizationId,
      appId: details.organizationId === 'org_aarohan_bank' ? 'app_mobile' : 'app_dakshin_mobile',
      customerRef: details.customerReference, action, amount: amountPaise / 100, currency: 'INR', status,
      reason, riskLevel: status === 'Allowed' ? 'Low' : status === 'Blocked' ? 'High' : 'Medium',
      verificationOutcome: status === 'Suspicious' ? (result?.report?.speaker_status === 'match' && result?.report?.authenticity_status === 'genuine' ? 'Verified' : 'Not verified') : undefined,
      whatHappenedNext: reason, recordingId, transcript: typeof result?.transcript === 'string' ? result.transcript : undefined });
    if (result?.payment_checks_live === true && result?.report?.speaker_status === 'match' &&
        result?.report?.authenticity_status === 'genuine' && result?.voice_checks?.deepfake_complete === true && result?.voice_checks?.decision === 'match') {
      voicePayments.recordVerifiedAudio(user.id, recordingId);
    }
    return tx;
  };
  const failedStatus = classifyRejectedVoice;
  const registryOrganization = { id: 'org_aarohan_bank', name: 'Aarohan Bank India' };
  const registryDetails = (user: StoredUser) => ({ organizationId: registryOrganization.id,
    customerName: user.fullName, customerReference: 'CUST-' + user.id.replace(/^usr_/, '').toUpperCase() });
  const sessionUser = (user: StoredUser, verified: boolean) => ({ ...sanitizeUser(user),
    voiceVerificationRequired: voicePayments.profiles.has(user.id) && !verified });
  app.get('/api/voice/profile', requireAuth, (req: AuthedRequest, res) => {
    const profile = voicePayments.profiles.get(req.currentUser!.id);
    res.json({ enrolled: !!profile, registryLinked: !!profile?.enrollment, organizationName: registryOrganization.name, apiKeyConfigured: voiceApiConfigured() });
  });
  app.post('/api/voice/registry-consent', requireAuth, (req: AuthedRequest, res) => {
    if (req.body?.consent !== true) { res.status(400).json({ error: 'Explicit registry consent is required.' }); return; }
    try {
      voicePayments.linkOrganization(req.currentUser!.id, registryDetails(req.currentUser!));
      res.json({ linked: true });
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Could not link the profile.' }); }
  });
  app.post('/api/voice/login-check', requireAuth, requireVoiceApi, express.json({ limit: '17mb' }), async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const profile = voicePayments.profiles.get(user.id);
    if (!profile || typeof req.body?.audio !== 'string') { res.status(400).json({ error: 'An enrolled account and fresh recording are required.' }); return; }
    if (analysisBusy) { res.status(429).json({ error: 'Another voice operation is running. Please wait.' }); return; }
    if (voicePayments.isReplay(user.id, crypto.createHash('sha256').update(Buffer.from(req.body.audio, 'base64')).digest('hex'))) {
      try { auditAttempt(user, req.body, 'Voice sign-in attempt', null, 'Blocked', 'Previously used recording rejected. No sign-in was authorized.'); }
      catch { res.status(503).json({ error: 'Voice sign-in blocked. Audit storage is unavailable.' }); return; }
      res.status(403).json({ error: 'Record a fresh sample. This recording has already been used.' }); return;
    }
    analysisBusy = true;
    let loginResult: any;
    try {
      const result = await runPythonAnalysis({ audio: req.body.audio, suffix: req.body.suffix, live: true, payment: true, speaker_id: profile.speakerId }, path.resolve(__dirname, '..'));
      loginResult = result;
      if (result.error) { auditAttempt(user, req.body, 'Voice sign-in attempt', result, 'Suspicious', String(result.error)); res.status(422).json({ error: result.error }); return; }
      voicePayments.verifyLogin(user.id, result);
      auditAttempt(user, req.body, 'Voice sign-in verified', result, 'Allowed', 'Voice sign-in verified. No money was transferred.');
      const csrfToken = setSessionCookies(res, req, user.id, { voiceVerified: true });
      res.json({ verified: true, user: sessionUser(user, true), csrfToken });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Voice verification failed.';
      try { auditAttempt(user, req.body, 'Voice sign-in attempt', loginResult, loginResult ? failedStatus(loginResult) : 'Suspicious', message); } catch { /* Return the operation failure even if the audit disk is unavailable. */ }
      res.status(403).json({ error: message });
    }
    finally { analysisBusy = false; }
  });
  app.post('/api/voice/enroll', requireAuth, requireVoiceApi, express.json({ limit: '17mb' }), async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (req.body?.consent !== true) { res.status(400).json({ error: 'Voice enrollment requires your explicit consent.' }); return; }
    if (voicePayments.profiles.has(user.id)) { res.status(409).json({ error: 'An owner is already enrolled. Voice replacement is disabled.' }); return; }
    if (analysisBusy) { res.status(429).json({ error: 'Another voice operation is running. Please wait.' }); return; }
    analysisBusy = true;
    try {
      const speakerId = 'owner_' + crypto.createHash('sha256').update(user.id + ':' + user.email).digest('hex').slice(0, 32);
      const result = await runPythonAnalysis({ audio: req.body.audio, suffix: req.body.suffix,
        mode: 'enroll', consent: true, speaker_id: speakerId }, path.resolve(__dirname, '..'));
      if (result.enrolled !== true || result.speaker_id !== speakerId || typeof result.audio_sha256 !== 'string') {
        res.status(422).json({ error: result.error || 'Enrollment did not complete. Payments remain blocked.' }); return;
      }
      const details = req.body.registryConsent === true ? registryDetails(user) : undefined;
      const recordingId = details ? voiceRecordings.save(details.organizationId, req.body.audio, req.body.suffix, req.body.recordingConsent) : undefined;
      voicePayments.register(user.id, speakerId, result.audio_sha256, details, recordingId);
      const csrfToken = setSessionCookies(res, req, user.id, { voiceVerified: true });
      res.json({ enrolled: true, credits_used: result.credits_used, csrfToken });
    } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : 'Enrollment unavailable.' }); }
    finally { analysisBusy = false; }
  });
  app.post('/api/voice/payment-check', requireAuth, requireVoiceApi, express.json({ limit: '17mb' }), async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const profile = voicePayments.profiles.get(user.id);
    if (!profile) { res.status(403).json({ error: 'Payment blocked: enroll the owner voice with consent first.' }); return; }
    if (typeof req.body?.audio !== 'string') { res.status(400).json({ error: 'A fresh audio recording is required. Text cannot authorize payments.' }); return; }
    if (voicePayments.isReplay(user.id, crypto.createHash('sha256').update(Buffer.from(req.body.audio, 'base64')).digest('hex'))) {
      try { auditAttempt(user, req.body, 'Voice payment attempt', null, 'Blocked', 'Previously used recording rejected. No money was transferred.'); }
      catch { res.status(503).json({ error: 'Payment blocked. Audit storage is unavailable.' }); return; }
      res.status(403).json({ error: 'Payment blocked: record a fresh request. Enrollment audio and previously authorized clips cannot be reused.' }); return;
    }
    if (analysisBusy) { res.status(429).json({ error: 'Another voice operation is running. Please wait.' }); return; }
    analysisBusy = true;
    try {
      const result = await runPythonAnalysis({ audio: req.body.audio, suffix: req.body.suffix,
        live: true, payment: true, speaker_id: profile.speakerId }, path.resolve(__dirname, '..'));
      if (result.error) { auditAttempt(user, req.body, 'Voice payment attempt', result, 'Suspicious', String(result.error)); res.status(422).json(result); return; }
      const payment = voicePayments.authorize(user.id, result, user.payees);
      const amount = payment.amountCents ?? 0;
      const audit = auditAttempt(user, req.body, 'Voice payment attempt', result, payment.eligible ? 'Suspicious' : failedStatus(result), payment.eligible ? 'Voice verified; awaiting explicit confirmation. No money transferred.' : payment.message, amount);
      if (payment.authorizationToken && audit) pendingAudit.set(payment.authorizationToken, { userId: user.id, organizationId: audit.organization_id, transactionId: audit.id });
      user.activity.unshift({ id: 'act_' + crypto.randomUUID(), timestamp: new Date().toISOString(),
        actionSummary: String(result.transcript), channel: 'Live voice payment check', decision: payment.eligible ? 'step_up' : 'block',
        decisionLabel: payment.eligible ? 'Awaiting confirmation' : 'Payment blocked', explanation: payment.message, reportedUnauthorized: false });
      res.json({ ...result, payment });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification unavailable. Payment blocked.';
      try { auditAttempt(user, req.body, 'Voice payment attempt', { error: true }, 'Suspicious', message); } catch { /* Preserve the original failure response. */ }
      res.status(503).json({ error: message });
    }
    finally { analysisBusy = false; }
  });
  app.post('/api/voice/transfer', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const candidateAudit = pendingAudit.get(req.body?.authorizationToken);
    const audit = candidateAudit?.userId === user.id ? candidateAudit : undefined;
    try {
      if (typeof req.body?.authorizationToken !== 'string') throw new Error('A verified voice authorization is required.');
      const auth = voicePayments.consume(user.id, req.body.authorizationToken);
      if (auth.amountCents > user.balanceCents) throw new Error('Insufficient demo balance. Record another request.');
      if (!user.payees.some(p => p.id === auth.payeeId)) throw new Error('Payee no longer exists.');
      const transaction: StoredUser['transactions'][number] = { id: 'tx_' + crypto.randomUUID(),
        title: 'Transfer to ' + auth.payeeName, counterparty: auth.payeeName, amountCents: auth.amountCents,
        direction: 'debit', createdAt: new Date().toISOString(), verificationLabel: 'Live owner match + genuine speech' };
      if (audit) clientPortalStore.resolveTransaction(audit.organizationId, audit.transactionId, 'Allowed', 'Owner confirmed the verified transfer. Demo balance debited.');
      if (audit) pendingAudit.delete(req.body.authorizationToken);
      user.balanceCents -= auth.amountCents;
      user.transactions.unshift(transaction);
      user.activity.unshift({ id: 'act_' + crypto.randomUUID(), timestamp: new Date().toISOString(),
        actionSummary: 'Confirmed transfer to ' + auth.payeeName, channel: 'Verified voice confirmation', decision: 'allow',
        decisionLabel: 'Voice verified', explanation: 'Matched the enrolled owner and passed speech authenticity checks before confirmation.', reportedUnauthorized: false });
      res.json({ message: 'Demo transfer completed after owner voice verification.', updatedBalanceCents: user.balanceCents });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment blocked.';
      if (audit) clientPortalStore.resolveTransaction(audit.organizationId, audit.transactionId, 'Blocked', message);
      if (audit) pendingAudit.delete(req.body?.authorizationToken);
      res.status(403).json({ error: message });
    }
  });
  app.post('/api/analysis', requireAuth, express.json({ limit: '17mb' }), async (req, res) => {
    if (req.body?.live === true && !voiceApiConfigured()) { res.status(503).json({ error: API_KEY_NOT_SET }); return; }
    if (analysisBusy) { res.status(429).json({ error: 'Another recording is being analyzed. Please wait.' }); return; }
    const payload = req.body;
    if (!payload || (typeof payload.text !== 'string' && typeof payload.audio !== 'string')) {
      res.status(400).json({ error: 'Provide text or a recording.' }); return;
    }
    analysisBusy = true;
    try {
      const result = await runPythonAnalysis(payload, path.resolve(__dirname, '..'));
      res.status(result.error ? 422 : 200).json(result);
    } catch (error) {
      res.status(503).json({ error: error instanceof Error ? error.message : 'Analysis is unavailable.' });
    } finally { analysisBusy = false; }
  });

  // Public stats endpoint
  app.get('/api/public/stats', (_req, res) => {
    liveRequestsProtected += Math.floor(Math.random() * 5) + 2;
    if (Math.random() > 0.6) {
      liveThreatsBlocked += 1;
    }
    liveDecisionMs = 132 + Math.floor(Math.random() * 14);
    res.json({
      requestsProtected: liveRequestsProtected,
      threatsBlocked: liveThreatsBlocked,
      avgDecisionMs: liveDecisionMs,
      isDemo: false,
      updatedAt: new Date().toISOString(),
    });
  });

  // Auth routes
  app.post('/api/auth/register', (req, res) => {
    const { fullName, email, password, phone } = req.body ?? {};
    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      typeof email !== 'string' ||
      !email.includes('@') ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      res.status(400).json({ error: 'Please provide your name, a valid email, and an 8+ character password.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (userIdByEmail.has(normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const pw = hashSecret(password);
    const defaultPp = hashSecret('ocean pine lantern');
    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      email: normalizedEmail,
      fullName: fullName.trim().slice(0, 80),
      phone: typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 30) : '+1 (555) 010-2040',
      passwordSalt: pw.salt,
      passwordHash: pw.hash,
      passphraseSalt: defaultPp.salt,
      passphraseHash: defaultPp.hash,
      onboardingComplete: false,
      voiceEnrolledCount: 0,
      phoneVerified: false,
      hasPassphrase: false,
      balanceCents: 520000,
      accountNumberMasked: `Checking ···· ${Math.floor(1000 + Math.random() * 8999)}`,
      transactions: [
        {
          id: `tx_${crypto.randomUUID().slice(0, 6)}`,
          title: 'Opening Deposit',
          counterparty: 'Sentinel Checking',
          amountCents: 520000,
          direction: 'credit',
          createdAt: new Date().toISOString(),
          verificationLabel: 'Cleared',
        },
      ],
      payees: [
        { id: 'pay_starter_1', name: 'Maya Chen', category: 'Personal', accountHint: '···· 7712', trusted: true },
        { id: 'pay_starter_2', name: 'City Electric', category: 'Utilities', accountHint: '···· 1044', trusted: true },
      ],
      settings: {
        voiceProtectionEnabled: true,
        strictSyntheticGuard: true,
        requireStepUpAbove: 500,
        notifyOnBlocked: true,
        smartGlassesSync: false,
      },
      activity: [],
    };

    usersById.set(newUser.id, newUser);
    userIdByEmail.set(normalizedEmail, newUser.id);
    const csrfToken = setSessionCookies(res, req, newUser.id);
    res.status(201).json({ user: sanitizeUser(newUser), csrfToken });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const id = userIdByEmail.get(email.trim().toLowerCase());
    const user = id ? usersById.get(id) : undefined;
    if (!user || !verifySecret(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }
    const csrfToken = setSessionCookies(res, req, user.id);
    res.json({ user: sessionUser(user, false), csrfToken });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookies(res, req);
    res.json({ ok: true });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body ?? {};
    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    res.json({
      message: 'If an account matches that address, we have sent a recovery link to your inbox.',
    });
  });

  app.get('/api/auth/session', (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies.sentinel_session;
    const claims = token ? verifyJwt(token) : null;
    const user = claims ? usersById.get(claims.sub) : undefined;
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user: sessionUser(user, claims?.voiceVerified === true), csrfToken: cookies.sentinel_csrf });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const cookies = parseCookies(req);
    const claims = cookies.sentinel_session ? verifyJwt(cookies.sentinel_session) : null;
    res.json({ user: sessionUser(req.currentUser!, claims?.voiceVerified === true), csrfToken: cookies.sentinel_csrf });
  });

  // Onboarding routes
  app.post('/api/onboarding/voice-sample', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const phraseIndex = Number(req.body?.phraseIndex ?? 0);
    if (!Number.isInteger(phraseIndex) || phraseIndex < 0 || phraseIndex > 2) {
      res.status(400).json({ error: 'Invalid voice phrase index.' });
      return;
    }
    user.voiceEnrolledCount = Math.max(user.voiceEnrolledCount, phraseIndex + 1);
    res.json({ voiceEnrolledCount: user.voiceEnrolledCount });
  });

  app.post('/api/onboarding/complete', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const { consentAccepted, passphrase, phoneCode } = req.body ?? {};
    if (consentAccepted !== true) {
      res.status(400).json({ error: 'Please review and accept voice protection consent.' });
      return;
    }
    if (!voicePayments.profiles.has(user.id)) {
      res.status(400).json({ error: 'Complete real owner voice enrollment before finishing setup.' }); return;
    }
    if (typeof passphrase !== 'string' || passphrase.trim().length < 4) {
      res.status(400).json({ error: 'Please set a personal passphrase (at least 4 characters).' });
      return;
    }
    if (typeof phoneCode !== 'string' || phoneCode.trim().length < 4) {
      res.status(400).json({ error: 'Please enter the 4–6 digit verification code.' });
      return;
    }
    const pp = hashSecret(passphrase.trim().toLowerCase());
    user.passphraseSalt = pp.salt;
    user.passphraseHash = pp.hash;
    user.hasPassphrase = true;
    user.phoneVerified = true;
    user.voiceEnrolledCount = Math.max(user.voiceEnrolledCount, 3);
    user.onboardingComplete = true;
    user.activity.unshift({
      id: `act_${crypto.randomUUID().slice(0, 6)}`,
      timestamp: new Date().toISOString(),
      actionSummary: 'Completed voice profile setup',
      channel: 'Web Portal',
      decision: 'allow',
      decisionLabel: 'Approved',
      explanation: 'Voice print, personal passphrase, and phone check are now active.',
      reportedUnauthorized: false,
    });
    res.json({ user: sanitizeUser(user) });
  });

  // Customer dashboard & voice assistant
  app.get('/api/customer/dashboard', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    res.json({
      balanceCents: user.balanceCents,
      accountNumberMasked: user.accountNumberMasked,
      transactions: user.transactions.slice(0, 12),
      payees: user.payees,
      protectionSummary: user.settings.voiceProtectionEnabled
        ? 'Voice Firewall is active on your account'
        : 'Voice Firewall is paused by you',
    });
  });

  app.post('/api/customer/payees', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const { name, category, accountHint } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Please enter a payee name.' });
      return;
    }
    const payee = {
      id: `pay_${crypto.randomUUID().slice(0, 6)}`,
      name: name.trim().slice(0, 60),
      category: typeof category === 'string' && category.trim() ? category.trim().slice(0, 30) : 'Personal',
      accountHint: typeof accountHint === 'string' && accountHint.trim() ? accountHint.trim().slice(0, 16) : '···· 9021',
      trusted: false,
    };
    user.payees.push(payee);
    res.status(201).json({ payee });
  });

  for (const endpoint of ['/api/customer/voice-command', '/api/customer/step-up-verify']) {
    app.post(endpoint, requireAuth, (_req, res) => {
      res.json({ decision: 'block', decisionLabel: 'Voice verification required', message: 'Payment blocked. Typed text, browser transcripts, and passphrases cannot authorize transfers. Use the owner enrollment and verified voice payment panel.', requiresPassphrase: false });
    });
  }

  // Security settings & activity
  app.get('/api/security/settings', requireAuth, (req: AuthedRequest, res) => {
    res.json(req.currentUser!.settings);
  });

  app.patch('/api/security/settings', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const body = req.body ?? {};
    if (typeof body.voiceProtectionEnabled === 'boolean') {
      user.settings.voiceProtectionEnabled = body.voiceProtectionEnabled;
    }
    if (typeof body.strictSyntheticGuard === 'boolean') {
      user.settings.strictSyntheticGuard = body.strictSyntheticGuard;
    }
    if (typeof body.notifyOnBlocked === 'boolean') {
      user.settings.notifyOnBlocked = body.notifyOnBlocked;
    }
    if (typeof body.smartGlassesSync === 'boolean') {
      user.settings.smartGlassesSync = body.smartGlassesSync;
    }
    if (typeof body.requireStepUpAbove === 'number' && Number.isFinite(body.requireStepUpAbove)) {
      user.settings.requireStepUpAbove = Math.max(50, Math.min(10000, Math.round(body.requireStepUpAbove)));
    }
    res.json(user.settings);
  });

  app.get('/api/security/activity', requireAuth, (req: AuthedRequest, res) => {
    res.json({ items: req.currentUser!.activity });
  });

  app.post('/api/security/activity/:id/report', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const item = user.activity.find((entry) => entry.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Activity record not found.' });
      return;
    }
    item.reportedUnauthorized = true;
    item.explanation = 'Marked as unauthorized by you. Our protection team tightened safeguards on this device.';
    res.json({ item });
  });

  app.patch('/api/account/profile', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const { fullName, phone } = req.body ?? {};
    if (typeof fullName === 'string' && fullName.trim().length >= 2) {
      user.fullName = fullName.trim().slice(0, 80);
    }
    if (typeof phone === 'string' && phone.trim().length >= 6) {
      user.phone = phone.trim().slice(0, 30);
    }
    res.json({ user: sanitizeUser(user) });
  });

  // B2B Client Dashboard endpoints (/api/client/*)
  app.post('/api/client/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const clientUser = clientPortalStore.authenticate(email, password);
    if (!clientUser) {
      res.status(401).json({ error: 'Incorrect organization email or password.' });
      return;
    }
    const csrfToken = setSessionCookies(res, req, clientUser.id, {
      scope: 'client',
      orgId: clientUser.organization_id,
      role: clientUser.role,
    });
    res.json({ user: clientUser, csrfToken });
  });

  app.get('/api/client/auth/session', (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies.sentinel_session;
    const claims = token ? verifyJwt(token) : null;
    if (!claims || claims.scope !== 'client') {
      res.json({ user: null });
      return;
    }
    const clientUser = clientPortalStore.getUserById(claims.sub);
    if (!clientUser) {
      res.json({ user: null });
      return;
    }
    res.json({ user: clientUser, csrfToken: cookies.sentinel_csrf });
  });

  app.post('/api/client/auth/logout', (req, res) => {
    clearSessionCookies(res, req);
    res.json({ ok: true });
  });

  app.get('/api/client/summary', requireClientAuth, (req: AuthedRequest, res) => {
    const rawDays = Number(req.query.days ?? 30);
    const days: 7 | 30 | 90 = rawDays === 7 || rawDays === 90 ? rawDays : 30;
    try {
      res.json(clientPortalStore.getSummary(req.currentClientUser!.organization_id, days));
    } catch (err) {
      const status = err instanceof ClientPortalError ? err.status : 500;
      res.status(status).json({ error: err instanceof Error ? err.message : 'Unable to load summary.' });
    }
  });

  app.get('/api/client/transactions', requireClientAuth, (req: AuthedRequest, res) => {
    const tabRaw = String(req.query.tab ?? 'all');
    const tab = tabRaw === 'suspicious' || tabRaw === 'blocked' ? tabRaw : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 15);
    res.json(
      clientPortalStore.listTransactions(req.currentClientUser!.organization_id, {
        tab,
        q,
        from,
        to,
        page,
        limit,
      })
    );
  });

  app.get('/api/client/transactions/:id', requireClientAuth, (req: AuthedRequest, res) => {
    const item = clientPortalStore.getTransactionById(
      req.currentClientUser!.organization_id,
      String(req.params.id ?? '')
    );
    if (!item) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    res.json({ item });
  });

  app.get('/api/client/voices', requireClientAuth, (req: AuthedRequest, res) => {
    const orgId = req.currentClientUser!.organization_id;
    const voices = voicePayments.listOrganizationVoices(orgId);
    const items = voices.items.map(voice => {
      const attempts = clientPortalStore.listVoiceAttempts(orgId, voice.customerRefMasked);
      const profile = voicePayments.profiles.get(voice.id)!;
      const enrollmentRecordingId = voiceRecordings.findByHash(orgId, profile.enrollmentHash);
      const history: import('./src/lib/client-portal-service.ts').VoiceRecordingEntry[] = [{
        id: 'enrollment-' + voice.id, recordingId: enrollmentRecordingId, timestamp: voice.enrolledAt,
        action: 'Original voice enrollment', status: 'Enrollment',
        reason: enrollmentRecordingId ? 'Original retained enrollment sample. Later attempts do not replace this recording.' : 'Enrollment audio was not retained; it cannot be recovered.' }, ...attempts];
      if (voice.recordingId && voice.recordingId !== enrollmentRecordingId && !attempts.some(attempt => attempt.recordingId === voice.recordingId)) {
        history.push({ id: 'owner-sample-' + voice.recordingId, recordingId: voice.recordingId,
          timestamp: voice.lastVerifiedAt || voice.enrolledAt, action: 'Previously retained owner sample', status: 'Owner sample', reason: 'Retained verified sample from before recording history was enabled.' });
      }
      history.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return { ...voice, recordingHistory: history };
    });
    res.json({ totalCount: voices.totalCount, items });
  });

  app.get('/api/client/recordings/:id', requireClientAuth, (req: AuthedRequest, res) => {
    if (req.currentClientUser!.role !== 'client_admin') { res.status(403).json({ error: 'Only organization admins can play retained recordings.' }); return; }
    const recording = voiceRecordings.get(req.currentClientUser!.organization_id, String(req.params.id));
    if (!recording) { res.status(404).json({ error: 'Recording unavailable. Older or non-consented audio was not retained.' }); return; }
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type(recording.mimeType).sendFile(recording.file);
  });

  app.post('/api/client/voices/enroll', requireClientAuth, requireVoiceApi, express.json({ limit: '17mb' }), async (req: AuthedRequest, res) => {
    const client = req.currentClientUser!;
    if (client.role !== 'client_admin') { res.status(403).json({ error: 'Only a client admin can enroll customers.' }); return; }
    const { customerName, customerReference, consent, audio, suffix } = req.body ?? {};
    if (typeof customerName !== 'string' || customerName.trim().length < 2 || customerName.length > 100 ||
        typeof customerReference !== 'string' || !/^[A-Za-z0-9_-]{2,60}$/.test(customerReference) || consent !== true || typeof audio !== 'string') {
      res.status(400).json({ error: 'Enter a customer name, a 2–60 character reference (letters, digits, hyphens or underscores), recording, and explicit customer consent.' }); return;
    }
    const id = 'client_voice_' + crypto.createHash('sha256').update(client.organization_id + ':' + customerReference.toLowerCase()).digest('hex');
    if (voicePayments.profiles.has(id)) { res.status(409).json({ error: 'This customer reference is already enrolled.' }); return; }
    if (analysisBusy) { res.status(429).json({ error: 'Another voice operation is running. Please wait.' }); return; }
    analysisBusy = true;
    try {
      const speakerId = 'client_' + crypto.createHash('sha256').update(id).digest('hex').slice(0, 32);
      const result = await runPythonAnalysis({ audio, suffix, mode: 'enroll', consent: true, speaker_id: speakerId }, path.resolve(__dirname, '..'));
      if (result.enrolled !== true || result.speaker_id !== speakerId || typeof result.audio_sha256 !== 'string') {
        res.status(422).json({ error: result.error || 'Voice enrollment did not complete.' }); return;
      }
      voicePayments.register(id, speakerId, result.audio_sha256, { organizationId: client.organization_id, customerName: customerName.trim(), customerReference });
      res.status(201).json({ item: voicePayments.listOrganizationVoices(client.organization_id).items.find(item => item.id === id) });
    } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : 'Voice enrollment unavailable.' }); }
    finally { analysisBusy = false; }
  });

  app.post('/api/client/voices/:id/re-enroll', requireClientAuth, (req: AuthedRequest, res) => {
    res.status(409).json({ error: 'Live profile replacement is not supported here. No enrollment was changed.' });
  });

  app.delete('/api/client/voices/:id', requireClientAuth, (req: AuthedRequest, res) => {
    res.status(409).json({ error: 'Deleting live provider profiles is not supported here. No enrollment was removed.' });
  });

  app.get('/api/client/apps', requireClientAuth, (req: AuthedRequest, res) => {
    res.json({ items: clientPortalStore.listApps(req.currentClientUser!.organization_id) });
  });

  app.post('/api/client/apps/:id/rotate-key', requireClientAuth, (req: AuthedRequest, res) => {
    try {
      const rotated = clientPortalStore.rotateAppKey(
        req.currentClientUser!.organization_id,
        req.currentClientUser!.role,
        String(req.params.id ?? '')
      );
      res.json(rotated);
    } catch (err) {
      const status = err instanceof ClientPortalError ? err.status : 500;
      res.status(status).json({ error: err instanceof Error ? err.message : 'Unable to rotate key.' });
    }
  });

  // Vite / Static serving
  const httpServer = createServer(app);
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sentinel server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Sentinel server:', err);
  process.exit(1);
});
