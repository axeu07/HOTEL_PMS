import { draftFromOccasion, sameDraft, validateOccasionDraft, type OccasionDraft } from '@/domain/occasions';
import { DomainError } from '@/lib/validation';
import { repositories } from '@/repositories';
import type { GuestOccasion, ID, OccasionSource, OccasionType } from '@/types/domain';
import { newId } from './core';

const clean = (s: string, max: number) => s.trim().slice(0, max);

const sameMoment = (a: GuestOccasion, b: { guestId: ID; reservationId: ID | null; type: OccasionType; date: string }) =>
  a.guestId === b.guestId && a.reservationId === b.reservationId && a.type === b.type && a.date === b.date;

export interface OccasionInput {
  guestId: ID;
  reservationId: ID | null;
  type: OccasionType;
  date: string;
  celebrant: string;
  notes: string;
}

export const occasionService = {
  async list(): Promise<GuestOccasion[]> {
    const rows = await repositories.occasions.list();
    return rows.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
  },

  async forGuest(guestId: ID): Promise<GuestOccasion[]> {
    return (await occasionService.list()).filter((o) => o.guestId === guestId);
  },

  /** The occasion raised for a stay: the booking's or check-in's answer, not a profile entry. */
  async forReservation(reservationId: ID): Promise<GuestOccasion | undefined> {
    const mine = (await repositories.occasions.list()).filter((o) => o.reservationId === reservationId);
    return mine.find((o) => o.source !== 'profile') ?? mine[0];
  },

  /**
   * Records the answer to "what's the occasion for your stay?" for one booking. Booking and check-in
   * both call this, and it updates the stay's existing occasion instead of adding a second one:
   * - nothing answered: nothing changes;
   * - "No Special Occasion": the stay's own occasion is removed;
   * - otherwise the existing occasion is updated, or one is created.
   * `verify` marks the answer as confirmed at the desk.
   */
  async saveForStay(
    stay: { reservationId: ID; guestId: ID },
    draft: OccasionDraft,
    opts: { source: OccasionSource; verify?: boolean } = { source: 'booking' },
  ): Promise<GuestOccasion | null> {
    if (!draft.type) return null;
    const existing = (await repositories.occasions.list()).filter((o) => o.reservationId === stay.reservationId);
    const own = existing.find((o) => o.type === draft.type && o.source !== 'profile') ?? existing.find((o) => o.source !== 'profile');

    if (draft.type === 'none') {
      await Promise.all(existing.filter((o) => o.source !== 'profile').map((o) => repositories.occasions.remove(o.id)));
      return null;
    }
    const problem = validateOccasionDraft(draft);
    if (problem) throw new DomainError(problem);

    const now = new Date().toISOString();
    const fields = {
      type: draft.type,
      date: draft.type === 'business_trip' ? '' : draft.date,
      celebrant: clean(draft.celebrant, 80),
      notes: clean(draft.notes, 500),
    };
    if (own) {
      if (!opts.verify && sameDraft(draftFromOccasion(own), { ...draft, ...fields })) return own;
      return repositories.occasions.update(own.id, { ...fields, updatedAt: now, ...(opts.verify ? { verifiedAt: now } : {}) });
    }
    // A profile entry already saying the same thing for this stay is the same occasion.
    const twin = existing.find((o) => sameMoment(o, { guestId: stay.guestId, reservationId: stay.reservationId, ...fields }));
    if (twin) return twin;
    return repositories.occasions.create({
      id: newId('occ'),
      guestId: stay.guestId,
      reservationId: stay.reservationId,
      ...fields,
      source: opts.source,
      createdAt: now,
      updatedAt: now,
      verifiedAt: opts.verify ? now : null,
    });
  },

  /** Adds an occasion from the guest's profile. */
  async add(input: OccasionInput): Promise<GuestOccasion> {
    const problem = validateOccasionDraft({ type: input.type, date: input.date, celebrant: input.celebrant, notes: input.notes });
    if (problem) throw new DomainError(problem);
    const date = input.type === 'business_trip' ? '' : input.date;
    const all = await repositories.occasions.list();
    if (all.some((o) => sameMoment(o, { ...input, date }))) throw new DomainError('That occasion is already on this guest’s profile.');
    const now = new Date().toISOString();
    return repositories.occasions.create({
      id: newId('occ'),
      guestId: input.guestId,
      reservationId: input.reservationId,
      type: input.type,
      date,
      celebrant: clean(input.celebrant, 80),
      notes: clean(input.notes, 500),
      source: 'profile',
      createdAt: now,
      updatedAt: now,
      verifiedAt: null,
    });
  },

  async update(id: ID, input: Omit<OccasionInput, 'guestId'>): Promise<GuestOccasion> {
    const current = await repositories.occasions.get(id);
    if (!current) throw new DomainError('That occasion no longer exists.');
    const problem = validateOccasionDraft({ type: input.type, date: input.date, celebrant: input.celebrant, notes: input.notes });
    if (problem) throw new DomainError(problem);
    const date = input.type === 'business_trip' ? '' : input.date;
    const all = await repositories.occasions.list();
    if (all.some((o) => o.id !== id && sameMoment(o, { guestId: current.guestId, reservationId: input.reservationId, type: input.type, date }))) {
      throw new DomainError('That occasion is already on this guest’s profile.');
    }
    return repositories.occasions.update(id, {
      reservationId: input.reservationId,
      type: input.type,
      date,
      celebrant: clean(input.celebrant, 80),
      notes: clean(input.notes, 500),
      updatedAt: new Date().toISOString(),
    });
  },

  remove: (id: ID) => repositories.occasions.remove(id),
};
