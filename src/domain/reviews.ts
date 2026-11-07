import type { GuestReview, ReviewRating } from '@/types/domain';

export const RATINGS: ReviewRating[] = [1, 2, 3, 4, 5];
export const COMMENT_MAX = 1000;
export const NAME_MAX = 80;
export const ROOM_MAX = 12;

export interface ReviewSummary {
  count: number;
  /** Null when there are no reviews, so an empty hotel never shows a made-up 0.0. */
  average: number | null;
  /** Reviews at each rating, 1 to 5. */
  distribution: Record<ReviewRating, number>;
}

export function summarizeReviews(reviews: GuestReview[]): ReviewSummary {
  const distribution: Record<ReviewRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of reviews) {
    distribution[r.rating] += 1;
    total += r.rating;
  }
  return { count: reviews.length, average: reviews.length ? total / reviews.length : null, distribution };
}

export type DatePreset = 'all' | '7' | '30' | '90' | 'custom';

export interface ReviewFilters {
  /** Null shows every rating. */
  rating: ReviewRating | null;
  preset: DatePreset;
  /** Inclusive local dates (YYYY-MM-DD), used by `custom`. */
  from: string;
  to: string;
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Reviews inside the date window; the rating filter is applied separately so the distribution stays whole. */
export function reviewsInPeriod(reviews: GuestReview[], filters: Pick<ReviewFilters, 'preset' | 'from' | 'to'>, now: Date): GuestReview[] {
  let from = '';
  let to = '';
  if (filters.preset === 'custom') {
    from = filters.from;
    to = filters.to;
  } else if (filters.preset !== 'all') {
    const start = new Date(now);
    start.setDate(start.getDate() - (Number(filters.preset) - 1));
    from = localDate(start);
  }
  return reviews.filter((r) => {
    const day = localDate(new Date(r.createdAt));
    return (!from || day >= from) && (!to || day <= to);
  });
}

export const reviewsWithRating = (reviews: GuestReview[], rating: ReviewRating | null) =>
  rating ? reviews.filter((r) => r.rating === rating) : reviews;

/** Newest first. */
export const newestFirst = (reviews: GuestReview[]) => [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/* ---------- Guest-facing wording ---------- */

export const RATING_FACES: Record<ReviewRating, { emoji: string; label: string; message: string }> = {
  1: { emoji: '😞', label: 'Very Bad', message: "We're so sorry. Please tell us what went wrong so we can make it right." },
  2: { emoji: '🙁', label: 'Bad', message: "We're sorry we fell short. Your feedback helps us do better." },
  3: { emoji: '😐', label: 'Okay', message: 'Thank you. What would have made your stay better?' },
  4: { emoji: '🙂', label: 'Good', message: "Glad you enjoyed it. Anything we could polish further?" },
  5: { emoji: '🤩', label: 'Excellent', message: "That's wonderful to hear! What made your stay special?" },
};
