import { nightsBetween } from '@/lib/dates';
import { classifyLoyalty, daysToBirthday, type LoyaltyTier } from './loyalty';
import type { Guest, ID, Invoice, InvoiceTotals, Lead, Reservation } from '@/types/domain';

/** What this file needs of a billing view, so it does not depend on the service layer. */
export interface BilledInvoice {
  invoice: Pick<Invoice, 'reservationId' | 'status'>;
  totals: Pick<InvoiceTotals, 'total'>;
}

export interface StayedGuest {
  guest: Guest;
  /** Completed stays. */
  stays: number;
  nights: number;
  firstVisit: string;
  lastVisit: string;
  /** Billed across completed stays, tax included. */
  spend: number;
  tier: LoyaltyTier;
  /** Every booking this guest has, newest first. */
  bookings: Reservation[];
  lastCategoryId: ID | null;
  upcoming: Reservation | null;
  birthdayIn: number | null;
}

/** Guests who have completed at least one stay, with what the hotel knows about them. */
export function buildStayedGuests(
  guests: Guest[],
  reservations: Reservation[],
  invoices: BilledInvoice[],
  now: string,
): StayedGuest[] {
  const billedByReservation = new Map<ID, number>();
  invoices.forEach((v) => {
    if (v.invoice.status !== 'void') billedByReservation.set(v.invoice.reservationId, (billedByReservation.get(v.invoice.reservationId) ?? 0) + v.totals.total);
  });
  const byGuest = new Map<ID, Reservation[]>();
  reservations.forEach((r) => byGuest.set(r.guestId, [...(byGuest.get(r.guestId) ?? []), r]));

  const out: StayedGuest[] = [];
  for (const guest of guests) {
    const all = (byGuest.get(guest.id) ?? []).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    const done = all.filter((r) => r.status === 'checked_out');
    if (done.length === 0) continue;
    const spend = done.reduce((s, r) => s + (billedByReservation.get(r.id) ?? 0), 0);
    out.push({
      guest,
      stays: done.length,
      nights: done.reduce((n, r) => n + nightsBetween(r.checkIn, r.checkOut), 0),
      firstVisit: done[done.length - 1].checkIn,
      lastVisit: done[0].checkOut,
      spend,
      tier: classifyLoyalty({ stays: done.length, spend, flaggedVip: guest.vip }),
      bookings: all,
      lastCategoryId: done[0].categoryId,
      upcoming: [...all].reverse().find((r) => ['confirmed', 'pending'].includes(r.status) && r.checkIn >= now) ?? null,
      birthdayIn: daysToBirthday(guest, now),
    });
  }
  return out;
}

/** Room revenue a converted lead brought in: the invoice if there is one, otherwise the nights at the booked rate. */
export function leadRevenue(lead: Lead, reservation: Reservation | undefined, billed: Map<ID, number>): number {
  if (lead.status !== 'converted' || !reservation || ['cancelled', 'no_show'].includes(reservation.status)) return 0;
  return billed.get(reservation.id) ?? nightsBetween(reservation.checkIn, reservation.checkOut) * reservation.ratePerNight;
}
