import { ApiError } from './api-client';
import type {
  ClientRole,
  ClientTxStatus,
  ClientRiskLevel,
  ClientVerificationOutcome,
  PublicClientApp,
  PublicClientVoice,
  SanitizedClientUser,
} from './client-portal-service';

export interface ClientTransactionDTO {
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

export interface ClientSummaryDTO {
  organizationName: string;
  days: 7 | 30 | 90;
  totalTransactions: number;
  totalValuePaise: number;
  blockedCount: number;
  suspiciousCount: number;
  dailySeries: Array<{ date: string; total: number; blocked: number }>;
  latestBlocked: ClientTransactionDTO[];
  latestSuspicious: ClientTransactionDTO[];
}

export interface ClientTransactionListResponse {
  items: ClientTransactionDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ClientSessionUser = SanitizedClientUser;
export type ClientPortalRole = ClientRole;

let clientCsrfToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const idx = cookie.indexOf('=');
    if (idx === -1) continue;
    if (cookie.slice(0, idx).trim() === name) {
      return decodeURIComponent(cookie.slice(idx + 1));
    }
  }
  return null;
}

async function clientRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('X-Requested-With', 'XMLHttpRequest');
    const csrf = readCookie('sentinel_csrf') ?? clientCsrfToken;
    if (csrf) headers.set('X-CSRF-Token', csrf);
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
    throw new ApiError('Unable to reach Sentinel servers right now.', 0, true);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (payload && typeof payload === 'object' && 'csrfToken' in payload && typeof payload.csrfToken === 'string') {
    clientCsrfToken = payload.csrfToken;
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : null) || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, response.status >= 502);
  }

  return payload as T;
}

export const clientApi = {
  getSession(): Promise<{ user: SanitizedClientUser | null; csrfToken?: string }> {
    return clientRequest('/api/client/auth/session');
  },

  login(email: string, password: string): Promise<{ user: SanitizedClientUser; csrfToken?: string }> {
    return clientRequest('/api/client/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    clientCsrfToken = null;
    return clientRequest('/api/client/auth/logout', { method: 'POST' });
  },

  getSummary(days: 7 | 30 | 90): Promise<ClientSummaryDTO> {
    return clientRequest(`/api/client/summary?days=${days}`);
  },

  getTransactions(params: {
    tab: 'all' | 'suspicious' | 'blocked';
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<ClientTransactionListResponse> {
    const qs = new URLSearchParams();
    qs.set('tab', params.tab);
    if (params.q) qs.set('q', params.q);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return clientRequest(`/api/client/transactions?${qs.toString()}`);
  },

  getTransactionById(id: string): Promise<{ item: ClientTransactionDTO }> {
    return clientRequest(`/api/client/transactions/${encodeURIComponent(id)}`);
  },

  getVoices(): Promise<{ totalCount: number; items: PublicClientVoice[] }> {
    return clientRequest('/api/client/voices');
  },

  requestVoiceReenroll(id: string): Promise<{ item: PublicClientVoice }> {
    return clientRequest(`/api/client/voices/${encodeURIComponent(id)}/re-enroll`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  deleteVoice(id: string): Promise<{ deletedId: string }> {
    return clientRequest(`/api/client/voices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  getApps(): Promise<{ items: PublicClientApp[] }> {
    return clientRequest('/api/client/apps');
  },

  rotateAppKey(
    id: string
  ): Promise<{ appId: string; appName: string; apiKeyOnce: string; rotatedAt: string }> {
    return clientRequest(`/api/client/apps/${encodeURIComponent(id)}/rotate-key`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};
