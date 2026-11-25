/**
 * INR currency utilities: stores monetary values strictly as integer paise (1 INR = 100 paise)
 * and formats values using Indian digit grouping (en-IN) or compact Lak/Crore notation.
 */

export const DEFAULT_FX_RATES_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 84.5,
  EUR: 91.2,
  GBP: 106.8,
  AED: 23.0,
  SGD: 62.8,
};

export interface ConvertedInrEntry {
  amountPaise: number;
  auditOriginalCurrency: string;
  auditOriginalAmount: number;
}

/**
 * Converts a monetary amount in any configured currency to integer INR paise on entry.
 * Original currency and amount are returned solely for server-side audit storage.
 */
export function convertToPaise(
  amount: number,
  currency: string,
  rates: Record<string, number> = DEFAULT_FX_RATES_TO_INR
): ConvertedInrEntry {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Amount must be a non-negative finite number.');
  }
  const code = String(currency ?? '').trim().toUpperCase();
  const rate = rates[code];
  if (!code || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  const amountPaise = Math.round(amount * rate * 100);
  if (!Number.isSafeInteger(amountPaise)) {
    throw new Error('Converted amount exceeds safe integer range.');
  }
  return {
    amountPaise,
    auditOriginalCurrency: code,
    auditOriginalAmount: amount,
  };
}

/**
 * Formats integer paise with the ₹ sign and Indian numbering system (en-IN),
 * e.g. 125000000 -> "₹12,50,000".
 */
export function formatInr(paise: number): string {
  const safePaise = Number.isFinite(paise) ? Math.round(paise) : 0;
  const rupees = safePaise / 100;
  const hasRemainder = safePaise % 100 !== 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasRemainder ? 2 : 0,
    maximumFractionDigits: hasRemainder ? 2 : 0,
  }).format(rupees);
}

/**
 * Compact INR formatting for overview KPI cards: e.g. ₹4.5 L, ₹1.2 Cr, ₹28.4 K.
 */
export function formatCompactInr(paise: number): string {
  const safePaise = Number.isFinite(paise) ? Math.round(paise) : 0;
  const absRupees = Math.abs(safePaise) / 100;
  const sign = safePaise < 0 ? '-' : '';

  if (absRupees >= 1_00_00_000) {
    const val = (absRupees / 1_00_00_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}₹${val} Cr`;
  }
  if (absRupees >= 1_00_000) {
    const val = (absRupees / 1_00_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}₹${val} L`;
  }
  if (absRupees >= 1_000) {
    const val = (absRupees / 1_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}₹${val} K`;
  }
  return formatInr(safePaise);
}
