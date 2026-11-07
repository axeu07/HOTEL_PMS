import { useMemo } from 'react';
import { useResource } from '@/hooks/useResource';
import { guestService, reservationService, roomService } from '@/services';
import type { Guest, ID, Reservation, Room, RoomCategory } from '@/types/domain';

export interface Lookups {
  rooms: Room[];
  categories: RoomCategory[];
  guests: Guest[];
  reservations: Reservation[];
  roomById: Map<ID, Room>;
  categoryById: Map<ID, RoomCategory>;
  guestById: Map<ID, Guest>;
}

/** The reference data most operational screens need, indexed for lookups. */
export function useLookups(): Lookups | null {
  const { data } = useResource(async () => {
    const [rooms, categories, guests, reservations] = await Promise.all([
      roomService.list(),
      roomService.categories(),
      guestService.list(),
      reservationService.list(),
    ]);
    return { rooms, categories, guests, reservations };
  });

  return useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      roomById: new Map(data.rooms.map((r) => [r.id, r])),
      categoryById: new Map(data.categories.map((c) => [c.id, c])),
      guestById: new Map(data.guests.map((g) => [g.id, g])),
    };
  }, [data]);
}
