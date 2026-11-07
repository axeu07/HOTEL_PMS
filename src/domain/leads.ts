import type { LeadSource, LeadStatus } from '@/types/domain';

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'quiet' | 'brass';

export const LEAD_SOURCE: Record<LeadSource, { label: string; short: string }> = {
  meta: { label: 'Meta / Facebook', short: 'Meta' },
  instagram: { label: 'Instagram', short: 'Instagram' },
  ota: { label: 'Booking platform / OTA', short: 'OTA' },
  website: { label: 'Website enquiry', short: 'Website' },
  walk_in: { label: 'Walk-in', short: 'Walk-in' },
  call: { label: 'Phone call', short: 'Call' },
  manual: { label: 'Added manually', short: 'Manual' },
  other: { label: 'Other marketing', short: 'Other' },
};
export const LEAD_SOURCE_ORDER: LeadSource[] = ['meta', 'instagram', 'ota', 'website', 'walk_in', 'call', 'manual', 'other'];

export const LEAD_STATUS: Record<LeadStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'info' },
  contacted: { label: 'Contacted', tone: 'quiet' },
  interested: { label: 'Interested', tone: 'brass' },
  follow_up: { label: 'Follow-up', tone: 'warn' },
  converted: { label: 'Converted', tone: 'good' },
  lost: { label: 'Lost', tone: 'bad' },
};
export const LEAD_STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'interested', 'follow_up', 'converted', 'lost'];

/** Open means still worth working: not yet a booking and not given up on. */
export const isOpenLead = (status: LeadStatus) => status !== 'converted' && status !== 'lost';
