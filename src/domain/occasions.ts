import type { IconName } from '@/components/icons';
import type { Guest, GuestOccasion, ID, ISODate, OccasionType, Reservation } from '@/types/domain';

export const OCCASION_LABEL: Record<OccasionType, string> = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  celebration: 'Special celebration',
  family_vacation: 'Family vacation',
  business_trip: 'Business trip',
  other: 'Other occasion',
};

/** What the dashboard row calls each category. */
export const OCCASION_PLURAL: Record<OccasionType, string> = {
  birthday: 'Birthdays',
  anniversary: 'Anniversaries',
  celebration: 'Special celebrations',
  family_vacation: 'Family vacations',
  business_trip: 'Business trips',
  other: 'Other special occasions',
};

/**
 * The categories Guest Occasions reports on. A business trip can be recorded on a booking but is not
 * a celebration, so it is kept on the profile and left out of these counts.
 */
export const OCCASION_CATEGORIES: OccasionType[] = ['birthday', 'anniversary', 'celebration', 'family_vacation', 'other'];

export const OCCASION_ICON: Record<OccasionType, IconName> = {
  birthday: 'cake',
  anniversary: 'gem',
  celebration: 'party',
  family_vacation: 'users',
  business_trip: 'building',
  other: 'sparkle',
};

/** What a booking form can answer. '' is "not asked / not answered"; 'none' is a deliberate "no occasion". */
export type OccasionChoice = '' | OccasionType | 'none';

export const OCCASION_CHOICES: { value: OccasionChoice; label: string }[] = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'family_vacation', label: 'Family Vacation' },
  { value: 'business_trip', label: 'Business Trip' },
  { value: 'celebration', label: 'Special Celebration' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'No Special Occasion' },
];

/** Which extra questions an occasion type needs. A business trip has no date or celebrant. */
export const asksDate = (t: OccasionChoice): boolean => !!t && t !== 'none' && t !== 'business_trip';
export const asksCelebrant = (t: OccasionChoice): boolean => t === 'birthday' || t === 'anniversary' || t === 'celebration';

export interface OccasionDraft {
  type: OccasionChoice;
  date: string;
  celebrant: string;
  notes: string;
}

export const emptyOccasionDraft = (): OccasionDraft => ({ type: '', date: '', celebrant: '', notes: '' });

export const draftFromOccasion = (o: GuestOccasion | undefined): OccasionDraft =>
  o ? { type: o.type, date: o.date, celebrant: o.celebrant, notes: o.notes } : emptyOccasionDraft();

/** True when two drafts say the same thing, so check-in does not rewrite what booking already saved. */
export const sameDraft = (a: OccasionDraft, b: OccasionDraft): boolean =>
  a.type === b.type && a.date === b.date && a.celebrant.trim() === b.celebrant.trim() && a.notes.trim() === b.notes.trim();

export function validateOccasionDraft(d: OccasionDraft): string {
  if (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return 'Enter the occasion date as day, month and year';
  return '';
}

const INACTIVE_STAY = ['cancelled', 'no_show'];

export interface OccasionRow {
  occasion: GuestOccasion;
  guest: Guest;
  reservation: Reservation | null;
  /** The day it is marked: the date given, otherwise the stay's arrival. Null when neither exists. */
  occursOn: ISODate | null;
  upcoming: boolean;
  /** The guest's most recent completed stay. */
  lastVisit: ISODate | null;
  /** The guest's next confirmed or pending booking. */
  nextStay: Reservation | null;
}

/**
 * One row per occasion, joined to the guest and the stay it came from. Occasions on cancelled or
 * no-show bookings, and ones whose guest no longer exists, are dropped: nothing will be celebrated.
 */
export function buildOccasionRows(occasions: GuestOccasion[], guests: Guest[], reservations: Reservation[], now: ISODate): OccasionRow[] {
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const reservationById = new Map(reservations.map((r) => [r.id, r]));
  const byGuest = new Map<ID, Reservation[]>();
  reservations.forEach((r) => byGuest.set(r.guestId, [...(byGuest.get(r.guestId) ?? []), r]));

  const rows: OccasionRow[] = [];
  for (const occasion of occasions) {
    const guest = guestById.get(occasion.guestId);
    if (!guest) continue;
    const reservation = occasion.reservationId ? (reservationById.get(occasion.reservationId) ?? null) : null;
    if (reservation && INACTIVE_STAY.includes(reservation.status)) continue;
    const theirs = byGuest.get(guest.id) ?? [];
    const finished = theirs.filter((r) => r.status === 'checked_out').sort((a, b) => b.checkOut.localeCompare(a.checkOut));
    const next = theirs
      .filter((r) => ['confirmed', 'pending'].includes(r.status) && r.checkIn >= now)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0] ?? null;
    const occursOn = occasion.date || reservation?.checkIn || null;
    rows.push({
      occasion,
      guest,
      reservation,
      occursOn,
      upcoming: !!occursOn && occursOn >= now,
      lastVisit: finished[0]?.checkOut ?? null,
      nextStay: next,
    });
  }
  return rows;
}

export interface OccasionSummary {
  type: OccasionType;
  total: number;
  upcoming: number;
  /** The nearest date still to come, if any. */
  nextOn: ISODate | null;
}

export function summariseOccasions(rows: OccasionRow[]): OccasionSummary[] {
  return OCCASION_CATEGORIES.map((type) => {
    const mine = rows.filter((r) => r.occasion.type === type);
    const coming = mine.filter((r) => r.upcoming && r.occursOn).map((r) => r.occursOn as string).sort();
    return { type, total: mine.length, upcoming: coming.length, nextOn: coming[0] ?? null };
  });
}

/** Whether a booking status still counts as a stay to look forward to. */
export const isLiveStay = (r: Reservation | null): boolean => !!r && !INACTIVE_STAY.includes(r.status);
