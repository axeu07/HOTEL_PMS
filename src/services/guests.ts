import { nightsBetween } from '@/lib/dates';
import { DomainError } from '@/lib/validation';
import { isLookupReady, samePhone } from '@/lib/phone';
import { repositories } from '@/repositories';
import type { Guest, ID } from '@/types/domain';
import { newId } from './core';

export type GuestInput = Omit<Guest, 'id' | 'createdAt'>;

export const emptyGuest = (): GuestInput => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  nationality: 'Indian',
  city: '',
  company: '',
  idType: '',
  idNumber: '',
  vip: false,
  preferences: { floor: 'no_preference', bed: 'no_preference', pillow: 'no_preference', dietary: 'none', notes: '' },
});

export const guestName = (g: Pick<Guest, 'firstName' | 'lastName'> | undefined | null): string =>
  g ? `${g.firstName} ${g.lastName}` : 'Unknown guest';

/** What the walk-in desk shows beside a recognised phone number. */
export interface GuestMatch {
  guest: Guest;
  /** Stays completed or under way. */
  visits: number;
  nights: number;
  lastVisit: string | null;
  lastRoomType: string | null;
  recent: { code: string; checkIn: string; checkOut: string; roomType: string }[];
}

export const guestService = {
  async list(): Promise<Guest[]> {
    const guests = await repositories.guests.list();
    return guests.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  },
  get: (id: ID) => repositories.guests.get(id),

  async create(input: GuestInput): Promise<Guest> {
    return repositories.guests.create({ ...input, id: newId('guest'), createdAt: new Date().toISOString() });
  },
  update: (id: ID, patch: Partial<Guest>) => repositories.guests.update(id, patch),

  async remove(id: ID) {
    const reservations = await repositories.reservations.list();
    if (reservations.some((r) => r.guestId === id)) {
      throw new DomainError('This guest has booking history, which must be kept with their invoices.');
    }
    const occasions = await repositories.occasions.list();
    await Promise.all(occasions.filter((o) => o.guestId === id).map((o) => repositories.occasions.remove(o.id)));
    await repositories.guests.remove(id);
  },

  /** Finds a saved guest by phone number, ignoring spacing, country prefix and a leading zero. */
  async findByPhone(phone: string): Promise<GuestMatch | null> {
    if (!isLookupReady(phone)) return null;
    const guest = (await repositories.guests.list()).find((g) => samePhone(g.phone, phone));
    if (!guest) return null;
    const [reservations, categories] = await Promise.all([repositories.reservations.list(), repositories.roomCategories.list()]);
    const typeName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Room';
    const stays = reservations
      .filter((r) => r.guestId === guest.id && (r.status === 'checked_out' || r.status === 'checked_in'))
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    const finished = stays.filter((r) => r.status === 'checked_out');
    return {
      guest,
      visits: stays.length,
      nights: stays.reduce((sum, r) => sum + nightsBetween(r.checkIn, r.checkOut), 0),
      lastVisit: finished[0]?.checkOut ?? null,
      lastRoomType: finished[0] ? typeName(finished[0].categoryId) : null,
      recent: stays.slice(0, 3).map((r) => ({ code: r.code, checkIn: r.checkIn, checkOut: r.checkOut, roomType: typeName(r.categoryId) })),
    };
  },

  async findOrCreateByEmail(input: GuestInput): Promise<Guest> {
    const guests = await repositories.guests.list();
    const match = guests.find((g) => g.email && g.email.toLowerCase() === input.email.trim().toLowerCase());
    return match ?? guestService.create(input);
  },
};
