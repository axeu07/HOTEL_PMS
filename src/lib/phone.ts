/** Phone numbers arrive as "+91 90000 12345", "09000012345" or "9000012345". Compare what the guest dials. */
export const phoneDigits = (value: string): string => value.replace(/\D/g, '');

/** The last ten digits, which identify a subscriber whatever country prefix or leading zero was typed. */
export const phoneKey = (value: string): string => phoneDigits(value).slice(-10);

/** True when there are enough digits to look someone up without matching half-typed numbers. */
export const isLookupReady = (value: string): boolean => phoneDigits(value).length >= 10;

export const samePhone = (a: string, b: string): boolean => isLookupReady(a) && isLookupReady(b) && phoneKey(a) === phoneKey(b);

/** wa.me wants digits only, with the country code. A bare ten-digit number is taken to be in the hotel's country. */
export function whatsappNumber(value: string, defaultCountryCode = '91'): string | null {
  const raw = value.trim();
  let digits = phoneDigits(raw);
  if (digits.length < 7) return null;
  if (!raw.startsWith('+')) {
    digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = defaultCountryCode + digits;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
