export const API_KEY_NOT_SET = 'API key not set. Ask the server administrator to configure DETECTIF_API_KEY in the backend .env file and restart the server.';

export function voiceApiConfigured(value = process.env.DETECTIF_API_KEY): boolean {
  const key = value?.trim();
  return !!key && !['your_actual_api_key', 'api key not set', 'your_api_key', 'my_api_key'].includes(key.toLowerCase());
}
