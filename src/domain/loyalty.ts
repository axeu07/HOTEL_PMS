import type { Guest } from '@/types/domain';

export type LoyaltyTier = 'new' | 'returning' | 'regular' | 'vip';

/**
 * Loyalty is worked out from completed stays, never stored, so it cannot drift from the bookings.
 * A guest marked VIP on their profile is always VIP.
 */
export const LOYALTY_RULES = {
  /** Completed stays that make a guest Regular. */
  regularStays: 4,
  /** Completed stays that make a guest VIP. */
  vipStays: 7,
  /** Lifetime billed spend (whole currency units) that makes a guest VIP whatever their stay count. */
  vipSpend: 350_000,
} as const;

export const LOYALTY_ORDER: LoyaltyTier[] = ['new', 'returning', 'regular', 'vip'];

export const LOYALTY_LABEL: Record<LoyaltyTier, { label: string; tone: 'quiet' | 'info' | 'good' | 'brass'; rule: string }> = {
  new: { label: 'New', tone: 'quiet', rule: 'One completed stay' },
  returning: { label: 'Returning', tone: 'info', rule: `2 to ${LOYALTY_RULES.regularStays - 1} stays` },
  regular: { label: 'Regular', tone: 'good', rule: `${LOYALTY_RULES.regularStays} to ${LOYALTY_RULES.vipStays - 1} stays` },
  vip: { label: 'VIP', tone: 'brass', rule: `${LOYALTY_RULES.vipStays}+ stays, ${LOYALTY_RULES.vipSpend / 1000}k+ spend, or marked VIP` },
};

export function classifyLoyalty(input: { stays: number; spend: number; flaggedVip: boolean }): LoyaltyTier {
  if (input.flaggedVip || input.stays >= LOYALTY_RULES.vipStays || input.spend >= LOYALTY_RULES.vipSpend) return 'vip';
  if (input.stays >= LOYALTY_RULES.regularStays) return 'regular';
  if (input.stays >= 2) return 'returning';
  return 'new';
}

/** Days from `from` until the guest's next birthday (0 = today), or null with no birthday saved. */
export function daysToBirthday(guest: Pick<Guest, 'birthday'>, from: string): number | null {
  if (!guest.birthday) return null;
  const [, m, d] = guest.birthday.split('-').map(Number);
  if (!m || !d) return null;
  const [fy, fm, fd] = from.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  let next = Date.UTC(fy, m - 1, d);
  if (next < start) next = Date.UTC(fy + 1, m - 1, d);
  return Math.round((next - start) / 86_400_000);
}
