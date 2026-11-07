import type { QrRegistration } from '@/types/domain';

export const REG_NAME_MAX = 80;
export const REG_MIN_AGE = 18;
export const REG_MAX_AGE = 120;
/** Accepted before downsizing. The stored copy is far smaller. */
export const REG_FILE_MAX_BYTES = 8 * 1024 * 1024;
export const REG_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Longest side of the stored ID image, in pixels. Enough to read a card, small enough to store. */
export const REG_IMAGE_EDGE = 1400;
export const REG_ID_TYPES: { id: QrRegistration['idType']; label: string }[] = [
  { id: 'national_id', label: 'National ID (Aadhaar, voter ID)' },
  { id: 'passport', label: 'Passport' },
  { id: 'driving_licence', label: 'Driving licence' },
];

export interface RegistrationFields {
  phone: string;
  name: string;
  age: string;
  idType: string;
}

/** The checks the guest sees immediately. The service repeats them: a browser can be bypassed. */
export function validateRegistration(f: RegistrationFields): Record<string, string> {
  const digits = f.phone.replace(/\D/g, '');
  const name = f.name.trim();
  const age = Number(f.age);
  return {
    phone: !f.phone.trim()
      ? 'Enter your phone number'
      : !/^\+?[\d\s()-]+$/.test(f.phone.trim()) || digits.length < 10 || digits.length > 15
        ? 'Enter a valid phone number, 10 to 15 digits'
        : '',
    name: !name
      ? 'Enter your name'
      : name.length < 2 ? 'Name is too short'
      : name.length > REG_NAME_MAX ? `Keep your name under ${REG_NAME_MAX} characters`
      : !/^\p{L}[\p{L} .'-]*$/u.test(name) ? 'Use letters only in your name' : '',
    age: !f.age.trim()
      ? 'Enter your age'
      : !Number.isInteger(age) ? 'Enter your age in whole years'
      : age < REG_MIN_AGE ? `Guests must be ${REG_MIN_AGE} or older to register. Please ask the desk.`
      : age > REG_MAX_AGE ? 'Enter a valid age' : '',
    idType: REG_ID_TYPES.some((t) => t.id === f.idType) ? '' : 'Choose the document you are uploading',
  };
}

export function validateIdFile(file: { type: string; size: number } | null | undefined): string {
  if (!file) return 'Upload a photo of your ID';
  if (!REG_FILE_TYPES.includes(file.type)) return 'Upload a JPG, PNG or WebP photo';
  if (file.size === 0) return 'That file is empty';
  if (file.size > REG_FILE_MAX_BYTES) return 'That photo is too large. Choose one under 8 MB.';
  return '';
}

export const splitName = (full: string): { firstName: string; lastName: string } => {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
};
