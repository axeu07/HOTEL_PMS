import type { CurrencyCode, ISODate, UserPreferences } from '@/types/domain';
import { parseDate } from './dates';

const LOCALES: Record<CurrencyCode, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  AED: 'en-AE',
};

let currency: CurrencyCode = 'INR';
let dateFormat: UserPreferences['dateFormat'] = 'dmy';

/** Display settings live here so that every formatter call agrees. */
export function configureFormat(opts: { currency?: CurrencyCode; dateFormat?: UserPreferences['dateFormat'] }) {
  if (opts.currency) currency = opts.currency;
  if (opts.dateFormat) dateFormat = opts.dateFormat;
}

export function money(value: number, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? !Number.isInteger(value);
  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
}

export function moneyCompact(value: number): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function fmtDate(iso: ISODate | null | undefined): string {
  if (!iso) return '–';
  const d = parseDate(iso);
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return dateFormat === 'dmy'
    ? `${d.getDate()} ${month} ${d.getFullYear()}`
    : `${month} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtDayMonth(iso: ISODate): string {
  const d = parseDate(iso);
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return dateFormat === 'dmy' ? `${d.getDate()} ${month}` : `${month} ${d.getDate()}`;
}

export function fmtWeekday(iso: ISODate): string {
  return parseDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(isoDateTime: string): string {
  const mins = Math.round((Date.now() - new Date(isoDateTime).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function percent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/, (c) => c.toUpperCase());
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
