import { staysOverlap } from '@/lib/dates';
import type { ID, ISODate, Reservation, Room } from '@/types/domain';

/** Statuses that hold inventory. Finished and cancelled stays release it. */
export const HOLDS_ROOM: Reservation['status'][] = ['pending', 'confirmed', 'checked_in'];

export interface StayWindow {
  checkIn: ISODate;
  checkOut: ISODate;
  /** Ignored when checking, so a booking does not clash with itself on edit. */
  excludeReservationId?: ID;
}

export function isRoomFree(room: Room, window: StayWindow, reservations: Reservation[]): boolean {
  if (room.status === 'maintenance') return false;
  return !reservations.some(
    (r) =>
      r.roomId === room.id &&
      r.id !== window.excludeReservationId &&
      HOLDS_ROOM.includes(r.status) &&
      staysOverlap(window.checkIn, window.checkOut, r.checkIn, r.checkOut),
  );
}

export function freeRooms(rooms: Room[], window: StayWindow, reservations: Reservation[], categoryId?: ID): Room[] {
  return rooms
    .filter((room) => !categoryId || room.categoryId === categoryId)
    .filter((room) => isRoomFree(room, window, reservations))
    .sort((a, b) => a.number.localeCompare(b.number));
}

/**
 * Rooms still sellable in a category: free rooms, less bookings in that
 * category that overlap the window but have not been given a room yet.
 */
export function sellableCount(rooms: Room[], window: StayWindow, reservations: Reservation[], categoryId: ID): number {
  const free = freeRooms(rooms, window, reservations, categoryId).length;
  const unassigned = reservations.filter(
    (r) =>
      r.categoryId === categoryId &&
      !r.roomId &&
      r.id !== window.excludeReservationId &&
      HOLDS_ROOM.includes(r.status) &&
      staysOverlap(window.checkIn, window.checkOut, r.checkIn, r.checkOut),
  ).length;
  return Math.max(0, free - unassigned);
}
