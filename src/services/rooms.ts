import { freeRooms, HOLDS_ROOM, sellableCount, type StayWindow } from '@/domain/availability';
import { DomainError } from '@/lib/validation';
import { repositories } from '@/repositories';
import type { CleaningStatus, ID, Room, RoomCategory } from '@/types/domain';
import { newId } from './core';

export const roomService = {
  async list(): Promise<Room[]> {
    const rooms = await repositories.rooms.list();
    return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  },
  categories: () => repositories.roomCategories.list(),

  async available(window: StayWindow, categoryId?: ID): Promise<Room[]> {
    const [rooms, reservations] = await Promise.all([repositories.rooms.list(), repositories.reservations.list()]);
    return freeRooms(rooms, window, reservations, categoryId);
  },

  async sellable(window: StayWindow, categoryId: ID): Promise<number> {
    const [rooms, reservations] = await Promise.all([repositories.rooms.list(), repositories.reservations.list()]);
    return sellableCount(rooms, window, reservations, categoryId);
  },

  async saveRoom(input: Omit<Room, 'id'> & { id?: ID }): Promise<Room> {
    const rooms = await repositories.rooms.list();
    if (rooms.some((r) => r.number === input.number && r.id !== input.id)) {
      throw new DomainError(`Room ${input.number} already exists.`);
    }
    if (input.id) return repositories.rooms.update(input.id, input);
    return repositories.rooms.create({ ...input, id: newId('room') });
  },

  async removeRoom(id: ID) {
    const reservations = await repositories.reservations.list();
    if (reservations.some((r) => r.roomId === id && HOLDS_ROOM.includes(r.status))) {
      throw new DomainError('This room has active or upcoming bookings. Move them to another room first.');
    }
    await repositories.rooms.remove(id);
  },

  async setCleaning(id: ID, cleaning: CleaningStatus) {
    await repositories.rooms.update(id, { cleaning });
  },

  /** Manual occupancy changes are limited: guests move rooms via check-in and check-out. */
  async setAvailability(id: ID, status: 'vacant' | 'maintenance') {
    const room = await repositories.rooms.get(id);
    if (!room) throw new DomainError('Room not found.');
    if (room.status === 'occupied') {
      throw new DomainError('A guest is in this room. Check them out or move them first.');
    }
    await repositories.rooms.update(id, { status });
  },

  async saveCategory(input: Omit<RoomCategory, 'id'> & { id?: ID }): Promise<RoomCategory> {
    if (input.id) return repositories.roomCategories.update(input.id, input);
    return repositories.roomCategories.create({ ...input, id: newId('cat') });
  },

  async removeCategory(id: ID) {
    const rooms = await repositories.rooms.list();
    if (rooms.some((r) => r.categoryId === id)) {
      throw new DomainError('Rooms still use this category. Reassign or remove them first.');
    }
    const reservations = await repositories.reservations.list();
    if (reservations.some((r) => r.categoryId === id)) {
      throw new DomainError('Bookings reference this category, so it must be kept for their history.');
    }
    await repositories.roomCategories.remove(id);
  },
};
