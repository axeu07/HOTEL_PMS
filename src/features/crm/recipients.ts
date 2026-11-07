import type { StayedGuest } from '@/domain/customers';
import { guestName } from '@/services';
import type { Lead } from '@/types/domain';
import type { Recipient } from './ContactModal';
import type { Crm } from './useCrm';

/** A guest who stayed, as someone to message. Their last room type and its rate are the starting offer. */
export const guestRecipient = (g: StayedGuest, crm: Crm): Recipient => ({
  key: g.guest.id,
  name: guestName(g.guest),
  phone: g.guest.phone,
  email: g.guest.email,
  guestId: g.guest.id,
  categoryId: g.lastCategoryId ?? '',
  price: g.lastCategoryId ? crm.categoryById.get(g.lastCategoryId)?.basePrice : undefined,
});

/** A lead as someone to message, carrying what they asked for so the template can use it. */
export const leadRecipient = (lead: Lead): Recipient => ({
  key: lead.id,
  name: lead.name,
  phone: lead.phone,
  email: lead.email,
  leadId: lead.id,
  categoryId: lead.categoryId,
  price: lead.budget || undefined,
  checkIn: lead.checkIn || undefined,
  checkOut: lead.checkOut || undefined,
  bookingToken: lead.bookingToken || undefined,
});
