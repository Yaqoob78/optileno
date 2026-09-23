export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'CAD' | 'AUD';

export const CURRENCIES: { code: Currency; label: string }[] = [
  { code: 'USD', label: 'US dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British pound' },
  { code: 'INR', label: 'Indian rupee' },
  { code: 'CAD', label: 'Canadian dollar' },
  { code: 'AUD', label: 'Australian dollar' },
];

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((c) => c.code === value);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency, cents: boolean): Intl.NumberFormat {
  const key = `${currency}:${cents}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f;
}

export function formatMoney(amount: number, currency: Currency): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return formatter(currency, !Number.isInteger(safe)).format(safe);
}

export function currencySymbol(currency: Currency): string {
  const part = formatter(currency, false).formatToParts(0).find((p) => p.type === 'currency');
  return part?.value ?? currency;
}

/** Rounds a price to a number a human would quote: 5s under 100, 10s under 1,000, 50s above. */
export function niceRound(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const step = amount < 100 ? 5 : amount < 1000 ? 10 : 50;
  return Math.max(step, Math.round(amount / step) * step);
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}

export function formatHoursShort(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${Math.round(hours * 10) / 10}h`;
}
