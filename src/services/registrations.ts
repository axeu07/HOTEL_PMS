import { REG_MAX_AGE, REG_MIN_AGE, REG_NAME_MAX, validateRegistration } from '@/domain/registration';
import { DomainError } from '@/lib/validation';
import { phoneKey, samePhone } from '@/lib/phone';
import { repositories } from '@/repositories';
import type { QrRegistration } from '@/types/domain';
import { hotelService, newId } from './core';
import { emptyGuest, guestService } from './guests';

/*
 * Guest self check-in. The public page can only do two things: learn the hotel's name from the QR
 * token, and submit one registration. It can never list, read or fetch a stored ID image.
 * Everything that reads registrations is in `registrationService`, used only behind the Front Desk
 * route's permission.
 *
 * With a real backend: `publicRegistrationService` becomes two unauthenticated endpoints; ID images go
 * to private object storage and staff view them through short-lived signed URLs; the checks below
 * (token, field rules, file type and size, rate limit, duplicate key) must be enforced server side.
 */

export interface PublicRegistrationHotel {
  name: string;
  city: string;
}

export interface RegistrationSubmission {
  phone: string;
  name: string;
  age: number;
  idType: string;
  /** A JPEG data URL produced by the page after downsizing the photo. */
  idDocument: string;
  submissionKey: string;
  /** Hidden field real guests never fill. Bots do. */
  website?: string;
}

const RATE_KEY = 'folio.register.sent';
export const REGISTER_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
/** About 1.5 MB of base64, which is a very generous ID photo after downsizing. */
const MAX_DOCUMENT_CHARS = 2_000_000;

const clean = (value: string, max: number) =>
  // eslint-disable-next-line no-control-regex
  value.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

function sentRecently(token: string, now: number): number[] {
  try {
    const all = JSON.parse(localStorage.getItem(RATE_KEY) ?? '{}') as Record<string, number[]>;
    return (all[token] ?? []).filter((t) => now - t < REGISTER_RATE_LIMIT.windowMs);
  } catch {
    return [];
  }
}

function noteSent(token: string, now: number) {
  try {
    const all = JSON.parse(localStorage.getItem(RATE_KEY) ?? '{}') as Record<string, number[]>;
    all[token] = [...sentRecently(token, now), now];
    localStorage.setItem(RATE_KEY, JSON.stringify(all));
  } catch {
    /* Without storage there is nothing to count against. */
  }
}

async function hotelByToken(token: string) {
  if (!/^[a-z0-9]{8,32}$/i.test(token)) return undefined;
  return (await repositories.hotels.list()).find((h) => h.registerToken === token);
}

export const publicRegistrationService = {
  async hotel(token: string): Promise<PublicRegistrationHotel | null> {
    const hotel = await hotelByToken(token);
    return hotel ? { name: hotel.name, city: hotel.city } : null;
  },

  async submit(token: string, input: RegistrationSubmission): Promise<void> {
    const hotel = await hotelByToken(token);
    if (!hotel) throw new DomainError('This registration link is not valid. Please scan the code at the hotel again.');
    if (!/^[\w-]{8,64}$/.test(input.submissionKey)) throw new DomainError('Something went wrong. Please reload the page and try again.');
    if (input.website) return; // A bot is told it worked and nothing is stored.

    const errors = validateRegistration({ phone: input.phone, name: input.name, age: String(input.age), idType: input.idType });
    const first = Object.values(errors).find(Boolean);
    if (first) throw new DomainError(first);
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.idDocument) || input.idDocument.length > MAX_DOCUMENT_CHARS) {
      throw new DomainError('The ID photo could not be used. Please choose a clear JPG, PNG or WebP photo.');
    }

    const existing = (await repositories.qrRegistrations.list()).find((r) => r.hotelId === hotel.id && r.submissionKey === input.submissionKey);
    if (existing) return;

    const now = Date.now();
    if (sentRecently(token, now).length >= REGISTER_RATE_LIMIT.max) {
      throw new DomainError('You have sent several registrations in a short time. Please ask the front desk for help.');
    }

    await repositories.qrRegistrations.create({
      id: newId('qrreg'),
      hotelId: hotel.id,
      name: clean(input.name, REG_NAME_MAX),
      phone: clean(input.phone, 20),
      age: Math.min(REG_MAX_AGE, Math.max(REG_MIN_AGE, Math.trunc(input.age))),
      idType: input.idType as QrRegistration['idType'],
      idDocument: input.idDocument,
      status: 'pending',
      submittedAt: new Date(now).toISOString(),
      submissionKey: input.submissionKey,
    });
    noteSent(token, now);
  },
};

export interface VerifiedDetails {
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  idType: QrRegistration['idType'];
  idNumber: string;
}

/** For signed-in staff: always the current hotel's registrations and nobody else's. */
export const registrationService = {
  async list(): Promise<QrRegistration[]> {
    const hotel = await hotelService.get();
    return (await repositories.qrRegistrations.list())
      .filter((r) => r.hotelId === hotel.id)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  },

  /** The address the QR code opens. */
  async publicUrl(): Promise<string> {
    const hotel = await hotelService.get();
    return `${window.location.origin}/register/${hotel.registerToken}`;
  },

  /**
   * Staff confirm what the guest sent, correcting anything wrong. The saved guest record is the one
   * the walk-in form will find next time; a repeat guest's record is updated, not duplicated.
   */
  async verify(id: string, details: VerifiedDetails) {
    const registration = await repositories.qrRegistrations.get(id);
    if (!registration) throw new DomainError('This registration no longer exists.');
    if (registration.status === 'verified') throw new DomainError('This registration was already verified.');
    if (!details.firstName.trim()) throw new DomainError('Enter the guest’s name.');
    if (!details.idNumber.trim()) throw new DomainError('Enter the ID number shown on the document.');
    const known = (await guestService.list()).find((g) => samePhone(g.phone, details.phone));
    const patch = {
      firstName: details.firstName.trim(),
      lastName: details.lastName.trim(),
      phone: details.phone.trim(),
      age: details.age,
      idType: details.idType,
      idNumber: details.idNumber.trim(),
    };
    const guest = known ? await guestService.update(known.id, patch) : await guestService.create({ ...emptyGuest(), ...patch });
    await repositories.qrRegistrations.update(id, { status: 'verified', guestId: guest.id });
    return guest;
  },

  async reject(id: string) {
    await repositories.qrRegistrations.update(id, { status: 'rejected' });
  },

  /** A pending registration with this phone number, if any. */
  async pendingForPhone(phone: string): Promise<QrRegistration | undefined> {
    const key = phoneKey(phone);
    return (await registrationService.list()).find((r) => r.status === 'pending' && phoneKey(r.phone) === key);
  },
};
