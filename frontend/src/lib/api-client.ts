import type { FirewallDecision } from './sentinel-logic';

export interface PublicStats {
  requestsProtected: number;
  threatsBlocked: number;
  avgDecisionMs: number;
  isDemo?: boolean;
  updatedAt: string;
}

export interface CustomerUser {
  voiceVerificationRequired?: boolean;
  id: string;
  email: string;
  fullName: string;
  phone: string;
  onboardingComplete: boolean;
  voiceEnrolledCount: number;
  phoneVerified: boolean;
  hasPassphrase: boolean;
}

export interface TransactionItem {
  id: string;
  title: string;
  counterparty: string;
  amountCents: number;
  direction: 'debit' | 'credit';
  createdAt: string;
  verificationLabel: string;
}

export interface PayeeItem {
  id: string;
  name: string;
  category: string;
  accountHint: string;
  trusted: boolean;
}

export interface DashboardData {
  balanceCents: number;
  accountNumberMasked: string;
  transactions: TransactionItem[];
  payees: PayeeItem[];
  protectionSummary: string;
}

export interface SecuritySettings {
  voiceProtectionEnabled: boolean;
  strictSyntheticGuard: boolean;
  requireStepUpAbove: number;
  notifyOnBlocked: boolean;
  smartGlassesSync: boolean;
}

export interface SecurityActivityItem {
  id: string;
  timestamp: string;
  actionSummary: string;
  channel: string;
  decision: FirewallDecision;
  decisionLabel: string;
  explanation: string;
  reportedUnauthorized: boolean;
}

export interface VoiceCommandResponse {
  decision: FirewallDecision;
  decisionLabel: string;
  message: string;
  requiresPassphrase: boolean;
  challengeId?: string;
  updatedBalanceCents?: number;
  newTransaction?: TransactionItem;
}

export class ApiError extends Error {
  status: number;
  isOffline: boolean;

  constructor(message: string, status: number, isOffline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isOffline = isOffline;
  }
}

let inMemoryCsrfToken: string | null = null;

export function setCsrfTokenForTests(token: string | null) {
  inMemoryCsrfToken = token;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf('=');
    if (eqIdx === -1) continue;
    const key = cookie.slice(0, eqIdx).trim();
    if (key === name) {
      return decodeURIComponent(cookie.slice(eqIdx + 1));
    }
  }
  return null;
}

function getCsrfToken(): string | null {
  return readCookie('sentinel_csrf') ?? inMemoryCsrfToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('X-Requested-With', 'XMLHttpRequest');
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      method,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      'Unable to reach Sentinel servers right now. Check your connection and try again.',
      0,
      true
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (payload && typeof payload === 'object' && 'csrfToken' in payload && typeof payload.csrfToken === 'string') {
    inMemoryCsrfToken = payload.csrfToken;
  }

  if (!response.ok) {
    if (path === '/api/analysis' && response.status === 404) {
      throw new ApiError('The running server does not have the analysis endpoint. Stop it with Ctrl+C, then run npm run dev from the frontend folder and refresh this page.', 404);
    }
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : null) || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, response.status >= 502);
  }

  return payload as T;
}

export const apiClient = {
  voiceProfile(): Promise<{ enrolled: boolean; registryLinked?: boolean; organizationName?: string }> { return request('/api/voice/profile'); },
  verifyVoiceLogin(payload: { audio: string; suffix: string; recordingConsent?: boolean }): Promise<{ verified: boolean; user: CustomerUser }> {
    return request('/api/voice/login-check', { method: 'POST', body: JSON.stringify(payload) });
  },
  linkVoiceRegistry(): Promise<{ linked: boolean }> {
    return request('/api/voice/registry-consent', { method: 'POST', body: JSON.stringify({ consent: true }) });
  },
  enrollOwner(payload: { audio: string; suffix: string; consent: boolean; registryConsent?: boolean; recordingConsent?: boolean }): Promise<{ enrolled: boolean; credits_used: number | null }> {
    return request('/api/voice/enroll', { method: 'POST', body: JSON.stringify(payload) });
  },
  checkPayment(payload: { audio: string; suffix: string; recordingConsent?: boolean }): Promise<AnalysisResponse> {
    return request('/api/voice/payment-check', { method: 'POST', body: JSON.stringify(payload) });
  },
  confirmVoiceTransfer(authorizationToken: string): Promise<{ message: string; updatedBalanceCents: number }> {
    return request('/api/voice/transfer', { method: 'POST', body: JSON.stringify({ authorizationToken }) });
  },
  analyze(payload: { text?: string; audio?: string; suffix?: string; live?: boolean }): Promise<AnalysisResponse> {
    return request<AnalysisResponse>('/api/analysis', { method: 'POST', body: JSON.stringify(payload) });
  },
  getPublicStats(): Promise<PublicStats> {
    return request<PublicStats>('/api/public/stats');
  },

  getSession(): Promise<{ user: CustomerUser | null; csrfToken?: string }> {
    return request<{ user: CustomerUser | null; csrfToken?: string }>('/api/auth/session');
  },

  getMe(): Promise<{ user: CustomerUser; csrfToken?: string }> {
    return request<{ user: CustomerUser; csrfToken?: string }>('/api/auth/me');
  },

  login(input: { email: string; password: string }): Promise<{ user: CustomerUser; csrfToken?: string }> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  register(input: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
  }): Promise<{ user: CustomerUser; csrfToken?: string }> {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    inMemoryCsrfToken = null;
    return request('/api/auth/logout', { method: 'POST' });
  },

  forgotPassword(email: string): Promise<{ message: string }> {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  submitVoiceSample(phraseIndex: number): Promise<{ voiceEnrolledCount: number }> {
    return request('/api/onboarding/voice-sample', {
      method: 'POST',
      body: JSON.stringify({ phraseIndex }),
    });
  },

  completeOnboarding(input: {
    consentAccepted: boolean;
    passphrase: string;
    phoneCode: string;
  }): Promise<{ user: CustomerUser }> {
    return request('/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getDashboard(): Promise<DashboardData> {
    return request('/api/customer/dashboard');
  },

  sendVoiceCommand(transcript: string, channel: 'mic' | 'typed'): Promise<VoiceCommandResponse> {
    return request('/api/customer/voice-command', {
      method: 'POST',
      body: JSON.stringify({ transcript, channel }),
    });
  },

  verifyStepUp(challengeId: string, passphrase: string): Promise<VoiceCommandResponse> {
    return request('/api/customer/step-up-verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId, passphrase }),
    });
  },

  addPayee(input: { name: string; category: string; accountHint: string }): Promise<{ payee: PayeeItem }> {
    return request('/api/customer/payees', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getSecuritySettings(): Promise<SecuritySettings> {
    return request('/api/security/settings');
  },

  updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
    return request('/api/security/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },

  getSecurityActivity(): Promise<{ items: SecurityActivityItem[] }> {
    return request('/api/security/activity');
  },

  reportUnauthorizedActivity(activityId: string): Promise<{ item: SecurityActivityItem }> {
    return request(`/api/security/activity/${encodeURIComponent(activityId)}/report`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  updateAccountProfile(input: { fullName: string; phone: string }): Promise<{ user: CustomerUser }> {
    return request('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
};

export interface AnalysisResponse {
  payment?: { eligible: boolean; message: string; authorizationToken?: string; amountCents?: number; payeeName?: string };
  transcript: string;
  report: {
    risk_level: string;
    speaker_status: string;
    authenticity_status: string;
    reasons: string[];
    guidance: string;
    limitations: string;
    intent: { intents: string[] };
  };
  guidance: string;
  source: string;
  credits_used: number | null;
  warnings: string[];
}
