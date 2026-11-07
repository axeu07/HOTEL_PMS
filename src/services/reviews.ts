import { COMMENT_MAX, NAME_MAX, RATINGS, ROOM_MAX } from '@/domain/reviews';
import { repositories } from '@/repositories';
import { DomainError } from '@/lib/validation';
import type { GuestReview, ReviewRating } from '@/types/domain';
import { hotelService, newId } from './core';

/*
 * Reviews belong to one hotel and are only ever read or written through that hotel. The public page
 * knows the hotel by its review token alone, and is handed back the name and tagline, nothing else.
 *
 * Everything the public page may call is in `publicReviewService`. With a real backend, these are the
 * calls to turn into endpoints, and the checks below (token, rating, length, duplicate key, rate limit)
 * must move server side with them: a browser can be bypassed.
 */

export interface PublicHotel {
  name: string;
  tagline: string;
  city: string;
}

export interface ReviewSubmission {
  rating: number;
  comment?: string;
  guestName?: string;
  roomNumber?: string;
  /** One per opened form; resending the same form stores it once. */
  submissionKey: string;
  /** Hidden field real guests never fill. Bots do. */
  website?: string;
}

const RATE_KEY = 'folio.review.sent';
export const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

const clean = (value: string | undefined, max: number) =>
  // eslint-disable-next-line no-control-regex
  (value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);

function sentRecently(token: string, now: number): number[] {
  try {
    const all = JSON.parse(localStorage.getItem(RATE_KEY) ?? '{}') as Record<string, number[]>;
    return (all[token] ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  } catch {
    return [];
  }
}

function noteSent(token: string, now: number) {
  try {
    const all = JSON.parse(localStorage.getItem(RATE_KEY) ?? '{}') as Record<string, number[]>;
    all[token] = [...sentRecently(token, now), now];
    localStorage.setItem(RATE_KEY, JSON.stringify(all));
  } catch {
    /* Without storage there is nothing to count against. */
  }
}

async function hotelByToken(token: string) {
  if (!/^[a-z0-9]{8,32}$/i.test(token)) return undefined;
  return (await repositories.hotels.list()).find((h) => h.reviewToken === token);
}

export const publicReviewService = {
  async hotel(token: string): Promise<PublicHotel | null> {
    const hotel = await hotelByToken(token);
    return hotel ? { name: hotel.name, tagline: hotel.tagline, city: hotel.city } : null;
  },

  async submit(token: string, input: ReviewSubmission): Promise<void> {
    const hotel = await hotelByToken(token);
    if (!hotel) throw new DomainError('This review link is not valid. Please scan the code again.');
    if (!RATINGS.includes(input.rating as ReviewRating)) throw new DomainError('Please choose a rating from 1 to 5.');
    if (!/^[\w-]{8,64}$/.test(input.submissionKey)) throw new DomainError('Something went wrong. Please reload the page and try again.');
    // A bot that fills the hidden field is told it worked and nothing is stored.
    if (input.website) return;

    const comment = clean(input.comment, COMMENT_MAX);
    if ((input.comment ?? '').length > COMMENT_MAX * 2) throw new DomainError(`Please keep your comment under ${COMMENT_MAX} characters.`);

    const existing = (await repositories.guestReviews.list()).find((r) => r.hotelId === hotel.id && r.submissionKey === input.submissionKey);
    if (existing) return;

    const now = Date.now();
    if (sentRecently(token, now).length >= RATE_LIMIT.max) {
      throw new DomainError('You have sent several reviews in a short time. Please try again later.');
    }

    await repositories.guestReviews.create({
      id: newId('rev'),
      hotelId: hotel.id,
      rating: input.rating as ReviewRating,
      comment,
      guestName: clean(input.guestName, NAME_MAX),
      roomNumber: clean(input.roomNumber, ROOM_MAX),
      submissionKey: input.submissionKey,
      createdAt: new Date(now).toISOString(),
    });
    noteSent(token, now);
  },
};

/** For signed-in staff: always the current hotel's reviews and nobody else's. */
export const reviewService = {
  async list(): Promise<GuestReview[]> {
    const hotel = await hotelService.get();
    return (await repositories.guestReviews.list()).filter((r) => r.hotelId === hotel.id);
  },
  /** The address the QR code opens. */
  async publicUrl(): Promise<string> {
    const hotel = await hotelService.get();
    return `${window.location.origin}/review/${hotel.reviewToken}`;
  },
};
