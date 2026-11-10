/**
 * Mock data for the AI Insights demonstration. Nothing here is computed by a model: every figure is
 * hand-authored (or derived from a fixed formula) so the screens look the same on every visit.
 * Dates are relative to today so the charts always point at the coming days.
 */
import { addDays, parseDate, today } from '@/lib/dates';
import type { ISODate } from '@/types/domain';

export const DEMO_LABEL = 'Demo preview';
export const DEMO_NOTE = 'Predictions on this page are simulated sample data. No AI model, external service or live booking data is used.';

/* ---------- Occupancy forecast ---------- */

export interface ForecastDay {
  date: ISODate;
  /** Predicted occupancy, percent. */
  predicted: number;
  low: number;
  high: number;
  /** Last year's actual, for context. */
  lastYear: number;
  /** Demand pressure, 0 to 100. */
  demand: number;
  note?: string;
}

/** A fixed shape: a weekend lift, a gentle wave, and a festival week around day 12 to 16. */
export function forecast(days: number): ForecastDay[] {
  const start = today();
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i + 1);
    const dow = parseDate(date).getDay();
    const weekend = dow === 5 || dow === 6 ? 13 : dow === 0 ? 6 : 0;
    const festival = i >= 11 && i <= 16 ? 14 - Math.abs(i - 14) * 3 : 0;
    const wave = Math.round(7 * Math.sin(i / 3.6));
    const predicted = Math.max(38, Math.min(98, 62 + weekend + festival + wave));
    const spread = 3 + Math.round(i * 0.22);
    const demand = Math.max(10, Math.min(100, Math.round(predicted * 1.04 + (festival ? 6 : 0) - 8)));
    return {
      date,
      predicted,
      low: Math.max(20, predicted - spread),
      high: Math.min(100, predicted + spread),
      lastYear: Math.max(30, Math.min(96, predicted - 5 + Math.round(5 * Math.cos(i / 2.4)))),
      demand,
      note: festival > 6 ? 'Festival week' : weekend >= 13 ? 'Weekend' : undefined,
    };
  });
}

export const FORECAST_RANGES = [
  { id: '7', label: '7 days', days: 7 },
  { id: '15', label: '15 days', days: 15 },
  { id: '30', label: '30 days', days: 30 },
] as const;

export const FORECAST_DRIVERS = [
  { label: 'Regional festival week', effect: '+14 pts', tone: 'good' as const, detail: 'Searches for the region rise 3 weeks ahead of the festival in last year’s pattern.' },
  { label: 'Weekend leisure demand', effect: '+11 pts', tone: 'good' as const, detail: 'Friday and Saturday nights fill first, mostly with couples from nearby cities.' },
  { label: 'Pre-monsoon softness', effect: '-6 pts', tone: 'warn' as const, detail: 'Midweek bookings dip when forecast rain is reported.' },
  { label: 'Corporate retreat cancelled', effect: '-3 pts', tone: 'warn' as const, detail: 'One group block of 6 rooms was released earlier this week.' },
];

/* ---------- Smart pricing ---------- */

export interface PricingRow {
  id: string;
  category: string;
  rooms: number;
  current: number;
  suggested: number;
  competitor: number;
  occupancy: number;
  confidence: number;
  reason: string;
}

export const PRICING: PricingRow[] = [
  { id: 'cat-courtyard', category: 'Mountain View Suite', rooms: 12, current: 6800, suggested: 7200, competitor: 7050, occupancy: 71, confidence: 88, reason: 'Nearby comparable rooms rose 4% for the festival week while yours has not moved.' },
  { id: 'cat-garden', category: 'Landour View Suite', rooms: 10, current: 8900, suggested: 9700, competitor: 9400, occupancy: 78, confidence: 91, reason: 'High weekend pick-up: 78% sold with 14 days to go, ahead of the usual 64%.' },
  { id: 'cat-lake', category: 'Lake Studio', rooms: 8, current: 11500, suggested: 12800, competitor: 12100, occupancy: 84, confidence: 86, reason: 'Fastest-selling category. Lake views are scarce and guests rarely compare on price.' },
  { id: 'cat-suite', category: 'Heritage Suite', rooms: 4, current: 18500, suggested: 18500, competitor: 18900, occupancy: 62, confidence: 79, reason: 'Priced in line with the market. Holding steady protects the premium positioning.' },
  { id: 'cat-residence', category: 'The Vasanta Residence', rooms: 2, current: 32000, suggested: 30500, competitor: 29800, occupancy: 41, confidence: 72, reason: 'Slow midweek demand. A small cut may fill two idle midweek nights.' },
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Demand index (100 is the yearly average) and the average rate the hotel achieved. */
export const SEASONAL = [
  { month: 'Jan', demand: 92, rate: 9100 },
  { month: 'Feb', demand: 88, rate: 8800 },
  { month: 'Mar', demand: 96, rate: 9300 },
  { month: 'Apr', demand: 104, rate: 9900 },
  { month: 'May', demand: 118, rate: 11400 },
  { month: 'Jun', demand: 112, rate: 10800 },
  { month: 'Jul', demand: 74, rate: 7600 },
  { month: 'Aug', demand: 68, rate: 7200 },
  { month: 'Sep', demand: 82, rate: 8100 },
  { month: 'Oct', demand: 108, rate: 10600 },
  { month: 'Nov', demand: 121, rate: 12100 },
  { month: 'Dec', demand: 127, rate: 13200 },
];

export const COMPETITORS = [
  { name: 'Lakeview Heritage', rating: 4.5, rate: 11900, position: 'Similar' },
  { name: 'The Deodar Retreat', rating: 4.3, rate: 9800, position: 'Below' },
  { name: 'Saffron Lodge', rating: 4.6, rate: 12600, position: 'Above' },
  { name: 'Orchard & Oak Inn', rating: 4.1, rate: 8400, position: 'Below' },
  { name: 'HOTEL PMS', rating: 4.6, rate: 11500, position: 'You' },
];

export const PRICING_IMPACT = { monthly: 486000, occupancyShift: -0.6, adrShift: 6.8 };

/* ---------- Guest timing ---------- */

export const CHECKIN_HOURS = [
  { hour: '12', label: '12 pm', checkIns: 4, checkOuts: 0 },
  { hour: '13', label: '1 pm', checkIns: 7, checkOuts: 0 },
  { hour: '14', label: '2 pm', checkIns: 14, checkOuts: 0 },
  { hour: '15', label: '3 pm', checkIns: 22, checkOuts: 0 },
  { hour: '16', label: '4 pm', checkIns: 27, checkOuts: 0 },
  { hour: '17', label: '5 pm', checkIns: 18, checkOuts: 0 },
  { hour: '18', label: '6 pm', checkIns: 11, checkOuts: 0 },
  { hour: '19', label: '7 pm', checkIns: 6, checkOuts: 0 },
  { hour: '20', label: '8 pm', checkIns: 3, checkOuts: 0 },
];

export const CHECKOUT_HOURS = [
  { hour: '07', label: '7 am', checkIns: 0, checkOuts: 3 },
  { hour: '08', label: '8 am', checkIns: 0, checkOuts: 9 },
  { hour: '09', label: '9 am', checkIns: 0, checkOuts: 17 },
  { hour: '10', label: '10 am', checkIns: 0, checkOuts: 26 },
  { hour: '11', label: '11 am', checkIns: 0, checkOuts: 31 },
  { hour: '12', label: '12 pm', checkIns: 0, checkOuts: 19 },
  { hour: '13', label: '1 pm', checkIns: 0, checkOuts: 6 },
];

export const TIMING_ALERTS = [
  { id: 't1', when: '3 – 5 pm', tone: 'warn' as const, title: 'Check-in rush expected', body: '49 arrivals are likely to land in two hours. Two desk agents and a bell team of three keep the average wait under four minutes.', confidence: 90, action: 'Notify front desk' },
  { id: 't2', when: '10 – 12 am', tone: 'warn' as const, title: 'Checkout peak, bills will queue', body: '57 departures cluster before noon. Pre-print folios by 9:30 am and open the express checkout counter.', confidence: 87, action: 'Alert housekeeping' },
  { id: 't3', when: '1 – 2 pm', tone: 'info' as const, title: 'Turn-around window is tight', body: 'Rooms vacated at 11 am must be ready before the 3 pm rush. 18 rooms are on a same-day turn.', confidence: 83, action: 'Prioritise turn rooms' },
  { id: 't4', when: '6 – 8 pm', tone: 'good' as const, title: 'Quiet evening for the desk', body: 'Late arrivals taper off. A good slot for the night audit prep and for guest welcome calls.', confidence: 76, action: 'Schedule tasks' },
];

export const TIMING_BY_DAY = [
  { day: 'Mon', peakIn: '4 pm', peakOut: '11 am', arrivals: 24, departures: 31 },
  { day: 'Tue', peakIn: '3 pm', peakOut: '10 am', arrivals: 19, departures: 22 },
  { day: 'Wed', peakIn: '3 pm', peakOut: '11 am', arrivals: 21, departures: 20 },
  { day: 'Thu', peakIn: '4 pm', peakOut: '11 am', arrivals: 28, departures: 23 },
  { day: 'Fri', peakIn: '4 pm', peakOut: '10 am', arrivals: 41, departures: 26 },
  { day: 'Sat', peakIn: '5 pm', peakOut: '11 am', arrivals: 37, departures: 38 },
  { day: 'Sun', peakIn: '2 pm', peakOut: '12 pm', arrivals: 15, departures: 44 },
];

/* ---------- Guest insights ---------- */

export const SEGMENTS = [
  { id: 'couples', label: 'Couples', guests: 534, share: 38, adr: 10400, stay: 2.4, repeat: 24, tone: 'teal' as const },
  { id: 'families', label: 'Families', guests: 379, share: 27, adr: 11800, stay: 3.1, repeat: 31, tone: 'gold' as const },
  { id: 'groups', label: 'Groups', guests: 197, share: 14, adr: 8200, stay: 2.0, repeat: 12, tone: 'info' as const },
  { id: 'business', label: 'Business', guests: 168, share: 12, adr: 9100, stay: 1.7, repeat: 41, tone: 'sage' as const },
  { id: 'solo', label: 'Solo travellers', guests: 126, share: 9, adr: 7600, stay: 2.2, repeat: 19, tone: 'blush' as const },
];

/** Loyalty is by number of completed stays. The four counts add up to the guests in the segments above. */
export const LOYALTY_TIERS = [
  { id: 'new', label: 'New', rule: 'First stay', guests: 612, avgStays: 1.0, revenueShare: 24, trend: 6, note: 'Mostly direct-site and partner bookings' },
  { id: 'returning', label: 'Returning', rule: '2 to 3 stays', guests: 486, avgStays: 2.4, revenueShare: 33, trend: 4, note: 'Often come back for the same season' },
  { id: 'regular', label: 'Regular', rule: '4 to 7 stays', guests: 232, avgStays: 5.1, revenueShare: 27, trend: 9, note: 'Book direct and ask for the same room type' },
  { id: 'vip', label: 'VIP', rule: '8+ stays or marked VIP', guests: 74, avgStays: 10.6, revenueShare: 16, trend: 3, note: 'Highest spend per stay and most extras' },
] as const;

/** Visits and last visit are days-ago, so the table reads the same whenever it is opened. Names are fictional. */
export const FREQUENT_GUESTS = [
  { id: 'f1', name: 'Ananya Iyer', segment: 'Couples', tier: 'VIP', visits: 14, lastVisitDaysAgo: 9, spend: 412000, vip: true },
  { id: 'f2', name: 'Rajan Malhotra', segment: 'Business', tier: 'VIP', visits: 12, lastVisitDaysAgo: 4, spend: 286000, vip: true },
  { id: 'f3', name: 'Sunita Kulkarni', segment: 'Families', tier: 'VIP', visits: 11, lastVisitDaysAgo: 31, spend: 365000, vip: true },
  { id: 'f4', name: 'Farhan Siddiqui', segment: 'Business', tier: 'Regular', visits: 9, lastVisitDaysAgo: 12, spend: 148000, vip: false },
  { id: 'f5', name: 'Meenal Joshi', segment: 'Couples', tier: 'Regular', visits: 7, lastVisitDaysAgo: 47, spend: 163000, vip: false },
  { id: 'f6', name: 'Gautam Rao', segment: 'Groups', tier: 'Regular', visits: 6, lastVisitDaysAgo: 68, spend: 204000, vip: false },
  { id: 'f7', name: 'Priyanka Sethi', segment: 'Families', tier: 'Regular', visits: 6, lastVisitDaysAgo: 22, spend: 139000, vip: false },
  { id: 'f8', name: 'Tobias Brandt', segment: 'Solo travellers', tier: 'Regular', visits: 5, lastVisitDaysAgo: 85, spend: 74000, vip: false },
] as const;

/** One card per season: who fills it, how loyal they are and how early they book. */
export const SEASON_TRENDS = [
  { season: 'Winter', peak: 'Couples', repeat: 29, lead: 34, note: 'Festive weekends sell out early' },
  { season: 'Spring', peak: 'Couples', repeat: 25, lead: 26, note: 'Steady, with the most late bookings' },
  { season: 'Summer', peak: 'Families', repeat: 33, lead: 41, note: 'School holidays lift stays by a third' },
  { season: 'Monsoon', peak: 'Couples', repeat: 38, lead: 12, note: 'Fewer guests, but the most loyal' },
  { season: 'Autumn', peak: 'Couples', repeat: 27, lead: 38, note: 'Groups and weddings return' },
] as const;

/** How far ahead guests book, as a share of bookings. */
export const BOOKING_LEAD = [
  { label: 'Same day', value: 6 },
  { label: '1 to 7 days', value: 18 },
  { label: '8 to 30 days', value: 34 },
  { label: '31 to 60 days', value: 29 },
  { label: 'More than 60 days', value: 13 },
];

/** Arrivals by weekday, as a share of the week's check-ins. */
export const ARRIVAL_DAYS = [
  { day: 'Mon', arrivals: 8 }, { day: 'Tue', arrivals: 7 }, { day: 'Wed', arrivals: 9 }, { day: 'Thu', arrivals: 13 },
  { day: 'Fri', arrivals: 24 }, { day: 'Sat', arrivals: 26 }, { day: 'Sun', arrivals: 13 },
];

export const SEASONAL_BOOKINGS = [
  { season: 'Winter', couples: 120, families: 60, groups: 34, business: 40 },
  { season: 'Spring', couples: 98, families: 74, groups: 28, business: 44 },
  { season: 'Summer', couples: 74, families: 142, groups: 46, business: 30 },
  { season: 'Monsoon', couples: 92, families: 40, groups: 14, business: 36 },
  { season: 'Autumn', couples: 130, families: 88, groups: 52, business: 42 },
];

export const ROOM_PREFERENCES = [
  { segment: 'Couples', picks: [{ label: 'Lake Studio', value: 46 }, { label: 'Landour View Suite', value: 28 }, { label: 'Heritage Suite', value: 16 }, { label: 'Mountain View Suite', value: 10 }] },
  { segment: 'Families', picks: [{ label: 'Landour View Suite', value: 44 }, { label: 'Heritage Suite', value: 27 }, { label: 'Mountain View Suite', value: 17 }, { label: 'Lake Studio', value: 12 }] },
  { segment: 'Groups', picks: [{ label: 'Mountain View Suite', value: 52 }, { label: 'Landour View Suite', value: 33 }, { label: 'Lake Studio', value: 9 }, { label: 'Heritage Suite', value: 6 }] },
  { segment: 'Business', picks: [{ label: 'Mountain View Suite', value: 58 }, { label: 'Landour View Suite', value: 31 }, { label: 'Heritage Suite', value: 8 }, { label: 'Lake Studio', value: 3 }] },
  { segment: 'Solo travellers', picks: [{ label: 'Mountain View Suite', value: 61 }, { label: 'Lake Studio', value: 21 }, { label: 'Landour View Suite', value: 14 }, { label: 'Heritage Suite', value: 4 }] },
];

export const GUEST_FACTS = [
  { label: 'Average booking lead time', value: '23 days', note: 'Couples book 31 days out, groups 52' },
  { label: 'Repeat guests', value: '27%', note: 'Business guests return most often' },
  { label: 'Top booking source', value: 'Direct site', note: '44% of all stays this season' },
  { label: 'Most requested extra', value: 'Late checkout', note: 'Asked for by 1 in 5 couples' },
];

export const GUEST_OPPORTUNITIES = [
  { id: 'g1', title: 'Family package for the summer holidays', body: 'Families book 142 stays in summer, double any other segment. A bundled two-room offer with kids’ activities would lift the length of stay.', confidence: 84, icon: 'users' as const, action: 'Draft package' },
  { id: 'g2', title: 'Couples’ lake-view weekends', body: 'Couples choose Lake Studio nearly half the time and book a month ahead. A flexible-date weekend offer could pull bookings forward.', confidence: 81, icon: 'star' as const, action: 'Draft offer' },
  { id: 'g3', title: 'Win back lapsed business guests', body: '41% of business guests return, but 63 have not booked in 8 months. A short, personal note tends to work best for this segment.', confidence: 74, icon: 'mail' as const, action: 'Preview message' },
];

/* ---------- Review intelligence ---------- */

export const REVIEW_SUMMARY = {
  rating: 4.6,
  count: 1284,
  responseRate: 92,
  distribution: [
    { stars: 5, count: 842 },
    { stars: 4, count: 268 },
    { stars: 3, count: 98 },
    { stars: 2, count: 46 },
    { stars: 1, count: 30 },
  ],
  sentiment: { positive: 78, neutral: 14, negative: 8 },
};

export const REVIEW_TREND = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  rating: Number((4.42 + i * 0.016 + Math.sin(i / 1.7) * 0.05).toFixed(2)),
  positive: Math.round(72 + i * 0.6 + Math.sin(i / 2) * 2),
}));

export interface Theme {
  id: string;
  topic: string;
  mentions: number;
  change: number;
  sentiment: 'positive' | 'negative';
  quote: string;
  suggestion?: string;
}

export const COMPLAINTS: Theme[] = [
  { id: 'c1', topic: 'Slow check-in at peak hours', mentions: 46, change: 12, sentiment: 'negative', quote: 'Lovely hotel, but we waited close to twenty minutes at the desk on arrival.', suggestion: 'Add a second agent between 3 and 5 pm, or offer a welcome drink while rooms are prepared.' },
  { id: 'c2', topic: 'Wi-Fi in the garden wing', mentions: 31, change: -4, sentiment: 'negative', quote: 'The connection drops in the far rooms, hard to take a video call.', suggestion: 'Raise a maintenance ticket to review the access point coverage on the garden wing.' },
  { id: 'c3', topic: 'Hot water in the early morning', mentions: 22, change: 6, sentiment: 'negative', quote: 'Hot water ran out around seven, just when everyone gets up.', suggestion: 'Check the geyser schedule for the morning peak.' },
  { id: 'c4', topic: 'Restaurant wait at dinner', mentions: 17, change: -9, sentiment: 'negative', quote: 'The food was wonderful, though service slowed on a full night.', suggestion: 'Stagger table bookings by 15 minutes on weekends.' },
];

export const PRAISE: Theme[] = [
  { id: 'p1', topic: 'Warm, personal staff', mentions: 412, change: 8, sentiment: 'positive', quote: 'Everyone remembered our names by the second day.' },
  { id: 'p2', topic: 'Lake and garden views', mentions: 337, change: 3, sentiment: 'positive', quote: 'Waking up to the lake was the highlight of our trip.' },
  { id: 'p3', topic: 'Breakfast spread', mentions: 268, change: 11, sentiment: 'positive', quote: 'The regional breakfast was the best part of every morning.' },
  { id: 'p4', topic: 'Calm, quiet atmosphere', mentions: 214, change: 2, sentiment: 'positive', quote: 'Genuinely peaceful, the courtyard became our favourite spot.' },
  { id: 'p5', topic: 'Cleanliness', mentions: 189, change: 5, sentiment: 'positive', quote: 'Spotless rooms and fresh linen with a lovely scent.' },
];

/* ---------- Staff planner ---------- */

export interface WorkloadDay {
  date: ISODate;
  roomsToClean: number;
  hoursNeeded: number;
  hoursScheduled: number;
  turnRooms: number;
}

/** Profiles are indexed by weekday (Sunday is 0), so the weekend peaks land on real weekends. */
const NEED_BY_DAY = [96, 78, 64, 58, 61, 84, 102];
const TURNS_BY_DAY = [20, 14, 9, 7, 8, 18, 22];
const ROSTER_BY_DAY = [82, 74, 66, 66, 66, 74, 82];

export function workload(): WorkloadDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today(), i);
    const dow = parseDate(date).getDay();
    return { date, roomsToClean: Math.round(NEED_BY_DAY[dow] / 1.7), hoursNeeded: NEED_BY_DAY[dow], hoursScheduled: ROSTER_BY_DAY[dow], turnRooms: TURNS_BY_DAY[dow] };
  });
}

export const SHIFTS = ['Morning', 'Afternoon', 'Evening'] as const;

/** Load per weekday and shift, as a share of capacity (100 means fully stretched). */
const SHIFT_LOAD_BY_DAY: number[][] = [
  [112, 96, 58],
  [92, 70, 38],
  [74, 58, 34],
  [66, 52, 30],
  [70, 56, 36],
  [96, 82, 52],
  [118, 104, 64],
];

export const shiftLoadFor = (date: ISODate) => SHIFT_LOAD_BY_DAY[parseDate(date).getDay()];

export const STAFF_RECOMMENDATIONS = [
  { id: 's1', priority: 'High', tone: 'bad' as const, title: 'Add 2 housekeepers on Saturday morning', body: 'Forecast load is 118% of capacity with 22 same-day turns. Without cover, some rooms will not be ready for the 3 pm check-in rush.', confidence: 89, impact: '+20 hours' },
  { id: 's2', priority: 'High', tone: 'bad' as const, title: 'Pull a floor supervisor onto Sunday checkouts', body: '44 departures are expected before noon, the heaviest of the week.', confidence: 85, impact: '+8 hours' },
  { id: 's3', priority: 'Medium', tone: 'warn' as const, title: 'Shift one front-desk agent to 3 – 5 pm on Friday', body: 'The desk is understaffed during the arrival rush but quiet before noon.', confidence: 81, impact: 'Swap shift' },
  { id: 's4', priority: 'Low', tone: 'good' as const, title: 'Release one housekeeper on Wednesday afternoon', body: 'Load drops to 52% of capacity. Use the time for deep-cleaning rotation or let them leave early.', confidence: 77, impact: '-4 hours' },
];

export const STAFF_KPIS = [
  { label: 'Rooms to clean this week', value: '319', note: 'Includes 98 same-day turns' },
  { label: 'Hours needed vs scheduled', value: '543 / 510', note: '33 hours short' },
  { label: 'Busiest shift', value: 'Sat morning', note: '118% of capacity' },
  { label: 'Quietest shift', value: 'Wed evening', note: '30% of capacity' },
];

/* ---------- Revenue insights ---------- */

export const REVENUE_OPPORTUNITIES = [
  { id: 'r1', title: 'Raise Landour View Suite weekend rates', impact: 214000, confidence: 91, effort: 'Low', body: 'Weekend demand is running well ahead of supply. A 9% rise still sits under the competitor average.', icon: 'tag' as const },
  { id: 'r2', title: 'Offer a breakfast add-on at booking', impact: 138000, confidence: 84, effort: 'Low', body: 'Only 19% of guests add breakfast. Showing it at the payment step lifts take-up in comparable hotels.', icon: 'soup' as const },
  { id: 'r3', title: 'Sell late checkout at the desk', impact: 96000, confidence: 79, effort: 'Medium', body: '1 in 5 couples asks for late checkout. A fixed fee turns a favour into revenue.', icon: 'clock' as const },
  { id: 'r4', title: 'Fill midweek gaps in the Residence', impact: 72000, confidence: 68, effort: 'Medium', body: 'Two midweek nights per month go empty. A two-night offer could take about half of them.', icon: 'bed' as const },
];

export const DISCOUNT_BANDS = [
  { band: 'No discount', bookings: 612, adr: 10900, share: 54 },
  { band: 'Up to 10%', bookings: 284, adr: 9800, share: 25 },
  { band: '10 – 20%', bookings: 156, adr: 8700, share: 14 },
  { band: 'Over 20%', bookings: 82, adr: 7300, share: 7 },
];

export const DISCOUNT_FINDINGS = [
  { label: 'Over-discounted bookings', value: '82', note: 'Over 20% off, with 61 that would likely have booked anyway', tone: 'bad' as const },
  { label: 'Revenue given away', value: '₹4.2L', note: 'Per quarter, on discounts above 15%', tone: 'warn' as const },
  { label: 'Best performing offer', value: 'Stay 3, pay 2', note: 'Adds 1.4 nights with only an 11% net discount', tone: 'good' as const },
];

export const CATEGORY_PERFORMANCE = [
  { category: 'Mountain View Suite', occupancy: 71, adr: 6900, revpar: 4900, target: 5200 },
  { category: 'Landour View Suite', occupancy: 78, adr: 9100, revpar: 7100, target: 6800 },
  { category: 'Lake Studio', occupancy: 84, adr: 11900, revpar: 10000, target: 9400 },
  { category: 'Heritage Suite', occupancy: 62, adr: 18700, revpar: 11600, target: 12400 },
  { category: 'The Vasanta Residence', occupancy: 41, adr: 31200, revpar: 12800, target: 17500 },
];

export const UPSELLS = [
  { id: 'u1', item: 'Lake-view upgrade', now: 6, potential: 17, price: 2500, window: 'At check-in' },
  { id: 'u2', item: 'Breakfast for two', now: 19, potential: 41, price: 1200, window: 'At booking' },
  { id: 'u3', item: 'Late checkout until 3 pm', now: 8, potential: 22, price: 1500, window: 'Day before departure' },
  { id: 'u4', item: 'Airport transfer', now: 11, potential: 24, price: 1800, window: 'After confirmation' },
  { id: 'u5', item: 'Sunset spa session', now: 4, potential: 12, price: 3200, window: 'During the stay' },
];

export const REVENUE_TREND = Array.from({ length: 12 }, (_, i) => {
  const base = 3_100_000 + i * 62_000 + Math.round(Math.sin(i / 1.8) * 140_000);
  return { week: `W${i + 1}`, actual: base, optimised: Math.round(base * (1.04 + i * 0.0035)) };
});

/* ---------- Overview ---------- */

export const SUMMARIES = [
  {
    headline: 'Demand is building into next weekend.',
    body: 'Occupancy is on course to reach 88% by Saturday, 11 points above the same weekend last year. Lake Studios and Landour View Suite are selling faster than their rates imply, so there is room to raise prices. Check-in pressure will peak between 3 and 5 pm, and Saturday morning housekeeping is the thinnest part of the week.',
  },
  {
    headline: 'Revenue is healthy; a few small leaks remain.',
    body: 'Average rate has crept up 6% over the past month and guest sentiment is at its best in a quarter. Discounts above 20% are the main drag, and most of those guests would likely have booked at a higher price. Six upcoming bookings carry an elevated chance of cancelling and are worth a gentle reminder.',
  },
  {
    headline: 'Plan for the festival fortnight now.',
    body: 'Searches for the region start to climb in about ten days, and last year’s pattern points to a six-day surge. Holding back a few Heritage Suites and tightening the cancellation window would protect the best nights. Staffing is the constraint, not rooms.',
  },
];

export const OVERVIEW_KPIS = [
  { id: 'k1', label: 'Predicted occupancy, next 7 days', value: '79%', trend: 6.2, note: 'vs last year', icon: 'bed' as const, tone: 'teal' as const, spark: [62, 66, 64, 71, 76, 84, 88], confidence: 88 },
  { id: 'k2', label: 'Suggested rate lift', value: '+6.8%', trend: 6.8, note: 'average daily rate', icon: 'tag' as const, tone: 'gold' as const, spark: [100, 101, 103, 102, 105, 106, 107], confidence: 86 },
  { id: 'k3', label: 'Revenue opportunity', value: '₹5.2L', trend: 9.4, note: 'next 30 days', icon: 'coins' as const, tone: 'sage' as const, spark: [3, 4, 4, 5, 6, 6, 7], confidence: 80 },
  { id: 'k4', label: 'Guest sentiment', value: '78%', trend: 2.1, note: 'positive reviews', icon: 'star' as const, tone: 'info' as const, spark: [72, 74, 73, 75, 77, 77, 78], confidence: 92 },
];

export const OVERVIEW_PREDICTIONS = [
  { id: 'o1', icon: 'login' as const, title: 'Check-in rush on Friday', body: '41 arrivals, 27 of them between 3 and 5 pm.', confidence: 90 },
  { id: 'o2', icon: 'broom' as const, title: 'Housekeeping stretched on Saturday', body: 'Load forecast at 118% of morning capacity.', confidence: 89 },
  { id: 'o3', icon: 'trendUp' as const, title: 'Festival surge from day 12', body: 'Six strong nights above 90% occupancy.', confidence: 82 },
  { id: 'o4', icon: 'message' as const, title: 'Slow check-in complaints are rising', body: 'Up 12% in mentions over the past month.', confidence: 85 },
];

export const OVERVIEW_ACTIONS = [
  { id: 'a1', icon: 'tag' as const, title: 'Review 3 suggested rate changes', body: 'Landour View Suite, Lake Studio and Courtyard are priced below the market.', to: '/app/ai/smart-pricing', cta: 'Open Smart Pricing', impact: '+₹5.1L / month' },
  { id: 'a2', icon: 'tasks' as const, title: 'Add 2 housekeepers on Saturday', body: 'Avoids late room handovers during the arrival rush.', to: '/app/ai/staff-planner', cta: 'Open Staff Planner', impact: '+20 hours' },
  { id: 'a3', icon: 'mail' as const, title: 'Send reminders to 6 at-risk bookings', body: 'A friendly confirmation note reduces last-minute cancellations.', to: '', cta: 'Preview reminder', impact: '₹1.1L protected' },
];

export interface CancellationRisk {
  id: string;
  code: string;
  guest: string;
  stay: string;
  category: string;
  value: number;
  risk: number;
  reasons: string[];
}

/** Fictional guests and codes. They are not linked to real bookings in the app. */
export const CANCELLATION_RISKS: CancellationRisk[] = [
  { id: 'x1', code: 'VC-4821', guest: 'Meera Kapoor', stay: 'Fri, 2 nights', category: 'Lake Studio', value: 23000, risk: 74, reasons: ['Booked 62 days ahead', 'Free-cancellation rate', 'No deposit paid'] },
  { id: 'x2', code: 'VC-4836', guest: 'Rohan Desai', stay: 'Sat, 1 night', category: 'Landour View Suite', value: 8900, risk: 68, reasons: ['Booked through a partner site', 'Two earlier cancellations'] },
  { id: 'x3', code: 'VC-4850', guest: 'Anika Shah', stay: 'Fri, 3 nights', category: 'Heritage Suite', value: 55500, risk: 61, reasons: ['Weather alert for the region', 'Rate lowered after booking'] },
  { id: 'x4', code: 'VC-4863', guest: 'Imran Qureshi', stay: 'Thu, 2 nights', category: 'Mountain View Suite', value: 13600, risk: 57, reasons: ['No reply to confirmation email', 'Group booking, no rooming list'] },
  { id: 'x5', code: 'VC-4877', guest: 'Tara Menon', stay: 'Sat, 2 nights', category: 'Lake Studio', value: 23000, risk: 52, reasons: ['Free-cancellation rate', 'Booked on impulse (under 2 days)'] },
];

export const CANCELLATION_SUMMARY = { flagged: 6, of: 41, atRisk: 143000, rate: 7.4 };
