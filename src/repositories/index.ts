import { createRepository } from './localStorageStore';

/**
 * The single switch point for persistence. To go live, replace these calls with
 * API-backed implementations of `Repository<T>`; nothing above this file changes.
 */
export const repositories = {
  hotels: createRepository('hotels'),
  roles: createRepository('roles'),
  users: createRepository('users'),
  roomCategories: createRepository('roomCategories'),
  rooms: createRepository('rooms'),
  guests: createRepository('guests'),
  reservations: createRepository('reservations'),
  invoices: createRepository('invoices'),
  payments: createRepository('payments'),
  housekeepingTasks: createRepository('housekeepingTasks'),
  maintenanceRequests: createRepository('maintenanceRequests'),
  menuItems: createRepository('menuItems'),
  restaurantOrders: createRepository('restaurantOrders'),
  staff: createRepository('staff'),
  duties: createRepository('duties'),
  attendance: createRepository('attendance'),
  activity: createRepository('activity'),
  guestReviews: createRepository('guestReviews'),
  qrRegistrations: createRepository('qrRegistrations'),
  leads: createRepository('leads'),
  messageTemplates: createRepository('messageTemplates'),
  communications: createRepository('communications'),
};

export type { Repository } from './types';
export { resetDatabase, seededOn, subscribeToData } from './localStorageStore';
