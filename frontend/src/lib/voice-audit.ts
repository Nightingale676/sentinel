/** A definite identity/authenticity rejection takes precedence over other inconclusive checks. */
export function classifyRejectedVoice(result: any): 'Blocked' | 'Suspicious' {
  if (result?.report?.speaker_status === 'no_match' || result?.report?.authenticity_status === 'synthetic') return 'Blocked';
  if (!result || result.error || result.report?.speaker_status === 'unknown' || result.report?.authenticity_status === 'unknown') return 'Suspicious';
  return 'Blocked';
}
