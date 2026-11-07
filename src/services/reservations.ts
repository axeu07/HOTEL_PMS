import { isRoomFree, sellableCount } from '@/domain/availability';
import { computeTotals } from '@/domain/billing';
import { addDays, nightsBetween, today } from '@/lib/dates';
import { money } from '@/lib/format';
import { DomainError } from '@/lib/validation';
import { repositories } from '@/repositories';
import type { BookingSource, ID, InvoiceTotals, PaymentMethod, Reservation } from '@/types/domain';
import { billingService } from './billing';
import { activityService, newId } from './core';
import { occasionService } from './occasions';
import type { OccasionDraft } from '@/domain/occasions';
import { guestName, guestService, type GuestInput } from './guests';

export interface ReservationInput {
  guestId: ID;
  categoryId: ID;
  roomId: ID | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  source: BookingSource;
  ratePerNight: number;
  notes: string;
  status?: 'pending' | 'confirmed';
}

export interface DepartureBill {
  invoiceId: ID;
  departure: string;
  nights: number;
  bookedNights: number;
  totals: InvoiceTotals;
}

async function categoryName(id: ID): Promise<string> {
  return (await repositories.roomCategories.get(id))?.name ?? 'Room';
}

async function nextCode(): Promise<string> {
  const reservations = await repositories.reservations.list();
  const max = reservations.reduce((m, r) => Math.max(m, Number(r.code.split('-')[1]) || 0), 20480);
  return `VC-${max + 1}`;
}

async function assertBookable(input: ReservationInput, excludeReservationId?: ID) {
  if (input.checkOut <= input.checkIn) throw new DomainError('Check-out must be after check-in.');
  const category = await repositories.roomCategories.get(input.categoryId);
  if (!category) throw new DomainError('Choose a room category.');
  if (input.adults + input.children > category.capacity) {
    throw new DomainError(`${category.name} sleeps up to ${category.capacity} guests.`);
  }
  const [rooms, reservations] = await Promise.all([repositories.rooms.list(), repositories.reservations.list()]);
  const window = { checkIn: input.checkIn, checkOut: input.checkOut, excludeReservationId };
  if (input.roomId) {
    const room = rooms.find((r) => r.id === input.roomId);
    if (!room) throw new DomainError('That room no longer exists.');
    if (room.categoryId !== input.categoryId) {
      throw new DomainError(`Room ${room.number} is not a ${category.name}.`);
    }
    if (!isRoomFree(room, window, reservations)) {
      throw new DomainError(`Room ${room.number} is not available for those dates.`);
    }
  } else if (sellableCount(rooms, window, reservations, input.categoryId) <= 0) {
    throw new DomainError(`${category.name} is sold out for those dates.`);
  }
}

export const reservationService = {
  async list(): Promise<Reservation[]> {
    const rows = await repositories.reservations.list();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  get: (id: ID) => repositories.reservations.get(id),

  async create(input: ReservationInput): Promise<Reservation> {
    await assertBookable(input);
    const reservation: Reservation = {
      id: newId('res'),
      code: await nextCode(),
      guestId: input.guestId,
      categoryId: input.categoryId,
      roomId: input.roomId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      status: input.status ?? 'confirmed',
      source: input.source,
      ratePerNight: input.ratePerNight,
      notes: input.notes,
      cancelReason: '',
      createdAt: new Date().toISOString(),
      checkedInAt: null,
      checkedOutAt: null,
    };
    await repositories.reservations.create(reservation);
    await billingService.createForReservation(reservation, await categoryName(input.categoryId));
    const guest = await repositories.guests.get(input.guestId);
    await activityService.log(`New booking ${reservation.code} for ${guestName(guest)}`, 'info', `/app/reservations?open=${reservation.id}`);
    return reservation;
  },

  async update(id: ID, input: ReservationInput): Promise<Reservation> {
    const current = await repositories.reservations.get(id);
    if (!current) throw new DomainError('Booking not found.');
    if (['checked_out', 'cancelled', 'no_show'].includes(current.status)) {
      throw new DomainError('Finished or cancelled bookings cannot be edited.');
    }
    if (current.status === 'checked_in') {
      if (!input.roomId) throw new DomainError('An in-house guest must stay assigned to a room.');
      if (input.checkIn !== current.checkIn) throw new DomainError('This guest has already checked in, so the arrival date is fixed.');
    }
    await assertBookable(input, id);

    // A room move for an in-house guest also has to move the room states.
    if (current.status === 'checked_in' && current.roomId !== input.roomId) {
      const target = await repositories.rooms.get(input.roomId!);
      if (target && target.cleaning !== 'clean') {
        throw new DomainError(`Room ${target.number} is not clean yet, so the guest cannot move there.`);
      }
      if (current.roomId) await repositories.rooms.update(current.roomId, { status: 'vacant', cleaning: 'dirty' });
      await repositories.rooms.update(input.roomId!, { status: 'occupied' });
    }

    const { status, ...fields } = input;
    const updated = await repositories.reservations.update(id, {
      ...fields,
      ...(current.status === 'checked_in' || !status ? {} : { status }),
    });
    await billingService.syncRoomCharge(updated, await categoryName(updated.categoryId));
    return updated;
  },

  async assignRoom(id: ID, roomId: ID | null) {
    const current = await repositories.reservations.get(id);
    if (!current) throw new DomainError('Booking not found.');
    await reservationService.update(id, { ...current, roomId, status: undefined });
  },

  async confirm(id: ID) {
    const current = await repositories.reservations.get(id);
    await repositories.reservations.update(id, { status: 'confirmed' });
    if (current) await activityService.log(`Booking ${current.code} confirmed`, 'success', `/app/reservations?open=${id}`);
  },

  async cancel(id: ID, reason: string) {
    const current = await repositories.reservations.get(id);
    if (!current) throw new DomainError('Booking not found.');
    if (current.status === 'checked_in') throw new DomainError('This guest is in house. Check them out instead.');
    if (current.status === 'checked_out') throw new DomainError('This stay has already finished.');
    await repositories.reservations.update(id, { status: 'cancelled', cancelReason: reason.trim(), roomId: null });
    await billingService.voidForReservation(id);
    await activityService.log(`Booking ${current.code} cancelled`, 'warning', `/app/reservations?open=${id}`);
  },

  async markNoShow(id: ID) {
    const current = await repositories.reservations.get(id);
    if (!current) throw new DomainError('Booking not found.');
    await repositories.reservations.update(id, { status: 'no_show', roomId: null });
    await billingService.voidForReservation(id);
    await activityService.log(`Booking ${current.code} marked as a no-show`, 'warning', `/app/reservations?open=${id}`);
  },

  async checkIn(id: ID) {
    const current = await repositories.reservations.get(id);
    if (!current) throw new DomainError('Booking not found.');
    if (!['confirmed', 'pending'].includes(current.status)) throw new DomainError('This booking cannot be checked in.');
    if (current.checkIn > today()) throw new DomainError('This booking does not arrive today. Edit the dates to bring it forward.');
    if (!current.roomId) throw new DomainError('Assign a room before checking in.');
    const room = await repositories.rooms.get(current.roomId);
    if (!room) throw new DomainError('The assigned room no longer exists.');
    if (room.status === 'occupied') throw new DomainError(`Room ${room.number} still has a guest in it.`);
    if (room.status === 'maintenance') throw new DomainError(`Room ${room.number} is out of service.`);
    if (room.cleaning !== 'clean') throw new DomainError(`Room ${room.number} is not clean yet. Choose another room or finish housekeeping.`);

    await repositories.rooms.update(room.id, { status: 'occupied' });
    await repositories.reservations.update(id, { status: 'checked_in', checkedInAt: new Date().toISOString() });
    const guest = await repositories.guests.get(current.guestId);
    await activityService.log(`${guestName(guest)} checked in to room ${room.number}`, 'success', `/app/reservations?open=${id}`);
  },

  /**
   * What the guest owes if they leave today. Guests are billed for the nights
   * actually stayed, so an early or late departure changes the room charge.
   * Nothing is saved here; `checkOut` applies it.
   */
  async departureBill(id: ID): Promise<DepartureBill> {
    const current = await repositories.reservations.get(id);
    if (!current) throw new DomainError('Booking not found.');
    const now = today();
    const departure = now > current.checkIn ? now : addDays(current.checkIn, 1);
    const nights = nightsBetween(current.checkIn, departure);
    const view = await billingService.viewForReservation(id);
    if (!view) throw new DomainError('No bill was found for this stay.');
    const adjusted = {
      ...view.invoice,
      lines: view.invoice.lines.map((line) => (line.kind === 'room' ? { ...line, quantity: nights } : line)),
    };
    return {
      invoiceId: view.invoice.id,
      departure,
      nights,
      bookedNights: nightsBetween(current.checkIn, current.checkOut),
      totals: computeTotals(adjusted, view.payments),
    };
  },

  /** An unpaid balance blocks departure unless a payment for it comes with the request. */
  async checkOut(id: ID, settlement?: { method: PaymentMethod; reference: string }) {
    const current = await repositories.reservations.get(id);
    if (!current) throw new DomainError('Booking not found.');
    if (current.status !== 'checked_in') throw new DomainError('Only in-house guests can be checked out.');

    const bill = await reservationService.departureBill(id);
    if (bill.totals.balance > 0.009 && !settlement) {
      throw new DomainError(`Balance of ${money(bill.totals.balance)} is still due. Record the payment first.`);
    }

    const now = today();
    if (bill.departure !== current.checkOut) {
      const stay = await repositories.reservations.update(id, { checkOut: bill.departure });
      await billingService.syncRoomCharge(stay, await categoryName(stay.categoryId));
    }
    if (bill.totals.balance > 0.009 && settlement) {
      await billingService.recordPayment(bill.invoiceId, { amount: bill.totals.balance, ...settlement });
    }

    await repositories.reservations.update(id, { status: 'checked_out', checkedOutAt: new Date().toISOString() });
    if (current.roomId) {
      await repositories.rooms.update(current.roomId, { status: 'vacant', cleaning: 'dirty' });
      await repositories.housekeepingTasks.create({
        id: newId('task'),
        roomId: current.roomId,
        type: 'checkout_clean',
        date: now,
        time: '',
        assigneeId: null,
        status: 'pending',
        priority: 'normal',
        notes: 'Created automatically at check-out.',
        completedAt: null,
      });
    }
    const guest = await repositories.guests.get(current.guestId);
    await activityService.log(`${guestName(guest)} checked out. Room queued for cleaning.`, 'success', '/app/housekeeping');
  },

  /** A walk-in is a same-day booking followed straight away by check-in. */
  async walkIn(input: { guest: GuestInput; existingGuestId?: ID; categoryId: ID; roomId: ID; checkOut: string; adults: number; children: number; ratePerNight: number; notes: string }) {
    // Check the room first, so a refused walk-in leaves no guest or booking behind.
    const room = await repositories.rooms.get(input.roomId);
    if (!room) throw new DomainError('Choose a room.');
    if (room.status !== 'vacant') throw new DomainError(`Room ${room.number} is not vacant.`);
    if (room.cleaning !== 'clean') throw new DomainError(`Room ${room.number} is not clean yet.`);
    const guest = input.existingGuestId
      ? await repositories.guests.get(input.existingGuestId)
      : await guestService.create(input.guest);
    if (!guest) throw new DomainError('Guest not found.');
    const reservation = await reservationService.create({
      guestId: guest.id,
      categoryId: input.categoryId,
      roomId: input.roomId,
      checkIn: today(),
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      source: 'walk_in',
      ratePerNight: input.ratePerNight,
      notes: input.notes,
    });
    await reservationService.checkIn(reservation.id);
    return reservation;
  },

  /** Public website request. Held as pending for the desk to confirm and allocate. */
  async requestFromWebsite(input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    categoryId: ID;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    notes: string;
    occasion?: OccasionDraft;
  }): Promise<Reservation> {
    const category = await repositories.roomCategories.get(input.categoryId);
    if (!category) throw new DomainError('Choose a room type.');
    const guest = await guestService.findOrCreateByEmail({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      nationality: '',
      city: '',
      company: '',
      idType: '',
      idNumber: '',
      vip: false,
      preferences: { floor: 'no_preference', bed: 'no_preference', pillow: 'no_preference', dietary: 'none', notes: '' },
    });
    const reservation = await reservationService.create({
      guestId: guest.id,
      categoryId: input.categoryId,
      roomId: null,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      source: 'website',
      ratePerNight: category.basePrice,
      notes: input.notes,
      status: 'pending',
    });
    if (input.occasion) await occasionService.saveForStay({ reservationId: reservation.id, guestId: guest.id }, input.occasion, { source: 'booking' });
    return reservation;
  },
};
