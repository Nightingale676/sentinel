import { expect, it } from 'vitest';
import { API_KEY_NOT_SET, voiceApiConfigured } from '../lib/voice-api-config';

it('treats missing keys and common placeholders as not configured', () => {
  for (const value of ['', '  ', 'your_actual_api_key', 'API key not set', 'YOUR_API_KEY', 'MY_API_KEY']) {
    expect(voiceApiConfigured(value)).toBe(false);
  }
});

it('reports only whether a non-placeholder key is present', () => {
  expect(voiceApiConfigured('  example-private-credential  ')).toBe(true);
  expect(API_KEY_NOT_SET).toContain('API key not set');
  expect(API_KEY_NOT_SET).not.toContain('example-private-credential');
});
