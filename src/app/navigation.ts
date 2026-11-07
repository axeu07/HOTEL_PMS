import type { IconName } from '@/components/icons';
import type { Permission } from '@/types/domain';

export interface NavItem {
  to: string;
  label: string;
  /** Shorter wording for the cramped sidebar group. The page keeps its full title. */
  shortLabel?: string;
  icon: IconName;
  /** Any one of these grants access. Omit for items every role can use. */
  anyOf?: Permission[];
  /** Sits inside the Property item's segmented control rather than as its own row. */
  inProperty?: boolean;
  /** Sits inside the Customers item's segmented control rather than as its own row. */
  inCustomers?: boolean;
  /**
   * Kept out of the sidebar. The page, its route, its permission and its data are all intact: it is
   * reached from the dashboard, from contextual links, notifications and search.
   */
  hidden?: boolean;
}

/** In sidebar order. A group's row appears where its first permitted page would be. */
export const NAV: NavItem[] = [
  { to: '/app/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/app/customers/stayed', label: 'Stayed', icon: 'star', anyOf: ['customers.view'], inCustomers: true },
  { to: '/app/customers/leads', label: 'Leads', icon: 'funnel', anyOf: ['customers.view'], inCustomers: true },
  { to: '/app/customers/occasions', label: 'Guest Occasions', shortLabel: 'Occasions', icon: 'cake', anyOf: ['customers.view'], inCustomers: true },
  { to: '/app/customers/templates', label: 'Message Templates', shortLabel: 'Templates', icon: 'message', anyOf: ['customers.view'], inCustomers: true },
  { to: '/app/front-desk', label: 'Front Desk', icon: 'concierge', anyOf: ['frontdesk.use'] },
  { to: '/app/rooms', label: 'Rooms', icon: 'bed', anyOf: ['rooms.view'], inProperty: true },
  { to: '/app/housekeeping', label: 'Housekeeping', icon: 'broom', anyOf: ['housekeeping.view'], inProperty: true },
  { to: '/app/guests', label: 'Guests', icon: 'users', anyOf: ['guests.view'], inProperty: true },
  { to: '/app/billing', label: 'Finance / Billing', icon: 'receipt', anyOf: ['billing.use'] },

  /* Out of the sidebar, still routed and permissioned. See `hidden`. */
  { to: '/app/quick-actions', label: 'Quick Actions', icon: 'tasks', anyOf: ['quickactions.view'], hidden: true },
  { to: '/app/reservations', label: 'Reservations', icon: 'calendar', anyOf: ['reservations.view'], hidden: true },
  { to: '/app/restaurant', label: 'Restaurant', icon: 'fork', anyOf: ['restaurant.use'], hidden: true },
  { to: '/app/reports', label: 'Reports', icon: 'chart', anyOf: ['reports.view'], hidden: true },
  { to: '/app/staff', label: 'Staff', icon: 'badge', anyOf: ['staff.view'], hidden: true },
  { to: '/app/settings', label: 'Settings', icon: 'gear', hidden: true },
];

export const CUSTOMERS_LABEL = 'Customers';

export const PROPERTY_LABEL = 'Property';

/**
 * AI Insights: a demonstration section of simulated predictions. It sits below Quick Actions in the
 * sidebar and shares the Reports permission, so roles without analytics access never see it.
 */
export const AI_LABEL = 'AI Insights';
export const AI_ANY_OF: Permission[] = ['reports.view'];
/** The sidebar shows one AI Insights row; the pages below it are reached by tabs along the page header. */
export const AI_HOME = '/app/ai/overview';

export const AI_NAV: NavItem[] = [
  { to: '/app/ai/overview', label: 'Overview', icon: 'dashboard' },
  { to: '/app/ai/smart-pricing', label: 'Smart Pricing', icon: 'tag' },
  { to: '/app/ai/guest-timing', label: 'Guest Timing', icon: 'clock' },
  { to: '/app/ai/guest-insights', label: 'Guest Insights', icon: 'users' },
  { to: '/app/ai/occupancy-forecast', label: 'Occupancy Forecast', icon: 'calendarRange' },
  { to: '/app/ai/review-intelligence', label: 'Review Intelligence', icon: 'message' },
  { to: '/app/ai/staff-planner', label: 'Staff Planner', icon: 'tasks' },
  { to: '/app/ai/revenue-insights', label: 'Revenue Insights', icon: 'coins' },
];
