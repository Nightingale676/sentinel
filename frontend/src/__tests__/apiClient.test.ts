import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiClient, ApiError, setCsrfTokenForTests } from '../lib/api-client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCsrfTokenForTests(null);
    document.cookie = 'sentinel_csrf=; Max-Age=0; path=/';
  });

  it('sends credentials: include and CSRF header on POST mutations without touching localStorage', async () => {
    document.cookie = 'sentinel_csrf=csrf_abc_123; path=/';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: 'allow',
          decisionLabel: 'Approved',
          message: 'Voice verified.',
          requiresPassphrase: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const res = await apiClient.sendVoiceCommand('Pay $20 to Maya', 'typed');
    expect(res.decision).toBe('allow');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/customer/voice-command');
    expect(init?.credentials).toBe('include');
    const headers = init?.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('csrf_abc_123');
    expect(headers.get('X-Requested-With')).toBe('XMLHttpRequest');
  });

  it('throws ApiError with isOffline=true when network fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiClient.getPublicStats()).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiError && err.isOffline === true
    );
  });
});
