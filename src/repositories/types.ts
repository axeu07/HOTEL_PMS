import type { Entity, ID } from '@/types/domain';

/**
 * The persistence contract. Services only ever talk to this interface, and it
 * is deliberately async, so an HTTP implementation can replace the localStorage
 * one without touching a service or a page. See README, "Moving to a real API".
 */
export interface Repository<T extends Entity> {
  list(): Promise<T[]>;
  get(id: ID): Promise<T | undefined>;
  create(entity: T): Promise<T>;
  update(id: ID, patch: Partial<T>): Promise<T>;
  remove(id: ID): Promise<void>;
}
