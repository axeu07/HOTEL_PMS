/** Small validators shared by every form. Each returns an error message or ''. */

export type Errors<T> = Partial<Record<keyof T | string, string>>;

export const required = (value: unknown, label = 'This field'): string =>
  value === null || value === undefined || String(value).trim() === '' ? `${label} is required` : '';

export const validEmail = (value: string): string =>
  value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? 'Enter a valid email address' : '';

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const validPhone = (value: string): string =>
  value.trim() && !/^[+\d][\d\s()-]{6,}$/.test(value.trim()) ? 'Enter a valid phone number' : '';

export const positive = (value: number, label = 'Value'): string =>
  !Number.isFinite(value) || value <= 0 ? `${label} must be greater than zero` : '';

export const nonNegative = (value: number, label = 'Value'): string =>
  !Number.isFinite(value) || value < 0 ? `${label} cannot be negative` : '';

export const hasErrors = (errors: Record<string, string | undefined>): boolean =>
  Object.values(errors).some(Boolean);

/** Errors thrown by services for rules the UI should show verbatim. */
export class DomainError extends Error {}

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.';
