/** Small validators for the stay request form. Each returns an error message or ''. */

export const required = (value: unknown, label = 'This field'): string =>
  value === null || value === undefined || String(value).trim() === '' ? `${label} is required` : '';

export const validEmail = (value: string): string =>
  value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? 'Enter a valid email address' : '';

export const validPhone = (value: string): string =>
  value.trim() && !/^[+\d][\d\s()-]{6,}$/.test(value.trim()) ? 'Enter a valid phone number' : '';

export const hasErrors = (errors: Record<string, string | undefined>): boolean =>
  Object.values(errors).some(Boolean);
