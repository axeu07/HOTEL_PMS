import { buildTemplates } from '@/data/crmDemo';
import { isOpenLead } from '@/domain/leads';
import { TEMPLATE_SEEDS, unknownVariables } from '@/domain/templates';
import { today } from '@/lib/dates';
import { DomainError } from '@/lib/validation';
import { repositories } from '@/repositories';
import type {
  CommunicationLog,
  ID,
  Lead,
  LeadActivity,
  LeadActivityKind,
  LeadSource,
  LeadStatus,
  MessageChannel,
  MessageTemplate,
} from '@/types/domain';
import { activityService, newId } from './core';
import { emptyGuest, guestService } from './guests';
import { reservationService } from './reservations';

/*
 * Customers: leads, message templates and the record of messages prepared for guests.
 *
 * Nothing here talks to Meta, Instagram or a booking platform: leads are entered by staff or come from
 * the sample data. Messages are not sent by this app either. WhatsApp or the mail app is opened with
 * the text ready, and the log records that it was prepared, not that it arrived.
 */

const entry = (kind: LeadActivityKind, text: string, by: string): LeadActivity => ({
  id: newId('la'),
  at: new Date().toISOString(),
  kind,
  text,
  by,
});

export interface LeadInput {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  sourceDetail: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  categoryId: ID | '';
  budget: number;
  notes: string;
  assignedTo: ID | '';
}

export const emptyLead = (): LeadInput => ({
  name: '',
  phone: '',
  email: '',
  source: 'manual',
  sourceDetail: '',
  checkIn: '',
  checkOut: '',
  adults: 2,
  categoryId: '',
  budget: 0,
  notes: '',
  assignedTo: '',
});

const TOKEN_PATTERN = /^[a-z0-9]{8,32}$/i;

function makeToken(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return 'bk' + Array.from(bytes, (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

async function getLead(id: ID): Promise<Lead> {
  const lead = await repositories.leads.get(id);
  if (!lead) throw new DomainError('That lead no longer exists.');
  return lead;
}

const withActivity = (lead: Lead, ...items: LeadActivity[]) => [...lead.activity, ...items];

export const leadService = {
  async list(): Promise<Lead[]> {
    const rows = await repositories.leads.list();
    return rows.sort((a, b) => b.enquiredAt.localeCompare(a.enquiredAt));
  },
  get: (id: ID) => repositories.leads.get(id),

  async create(input: LeadInput, by: string): Promise<Lead> {
    if (!input.name.trim()) throw new DomainError('Enter the lead’s name.');
    if (!input.phone.trim() && !input.email.trim()) throw new DomainError('Add a phone number or an email, so the lead can be contacted.');
    if (input.checkIn && input.checkOut && input.checkOut <= input.checkIn) throw new DomainError('Check-out must be after check-in.');
    const lead: Lead = {
      ...input,
      id: newId('lead'),
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      sourceDetail: input.sourceDetail.trim() || 'Added by staff',
      enquiredAt: new Date().toISOString(),
      status: 'new',
      followUpOn: '',
      lostReason: '',
      bookingToken: '',
      linkCreatedAt: null,
      linkOpenedAt: null,
      reservationId: null,
      convertedAt: null,
      activity: [entry('created', `Lead added: ${input.sourceDetail.trim() || 'added by staff'}`, by)],
    };
    await repositories.leads.create(lead);
    await activityService.log(`New lead: ${lead.name}`, 'info', '/app/customers/leads');
    return lead;
  },

  async update(id: ID, patch: Partial<LeadInput>, by: string): Promise<Lead> {
    const lead = await getLead(id);
    const next = { ...lead, ...patch };
    if (!next.name.trim()) throw new DomainError('Enter the lead’s name.');
    if (next.checkIn && next.checkOut && next.checkOut <= next.checkIn) throw new DomainError('Check-out must be after check-in.');
    return repositories.leads.update(id, { ...patch, activity: withActivity(lead, entry('note', 'Details updated', by)) });
  },

  async setStatus(id: ID, status: LeadStatus, by: string, details: { lostReason?: string; followUpOn?: string } = {}): Promise<Lead> {
    const lead = await getLead(id);
    if (lead.status === status && status !== 'follow_up') return lead;
    if (status === 'converted' && !lead.reservationId) {
      throw new DomainError('A lead becomes Converted when a booking is made for it. Use Create booking, or send its booking link.');
    }
    if (status === 'lost' && !details.lostReason?.trim()) throw new DomainError('Say why the lead was lost, so the team can learn from it.');
    if (status === 'follow_up' && !details.followUpOn) throw new DomainError('Choose the date for the follow-up.');
    const label = { new: 'New', contacted: 'Contacted', interested: 'Interested', follow_up: 'Follow-up', converted: 'Converted', lost: 'Lost' }[status];
    const items = [entry('status', `Marked as ${label}${status === 'lost' ? `: ${details.lostReason!.trim()}` : ''}`, by)];
    if (status === 'follow_up') items.push(entry('follow_up', `Follow-up set for ${details.followUpOn}`, by));
    return repositories.leads.update(id, {
      status,
      followUpOn: status === 'follow_up' ? details.followUpOn! : isOpenLead(status) ? lead.followUpOn : '',
      lostReason: status === 'lost' ? details.lostReason!.trim() : '',
      activity: withActivity(lead, ...items),
    });
  },

  async setFollowUp(id: ID, date: string, by: string): Promise<Lead> {
    const lead = await getLead(id);
    return repositories.leads.update(id, {
      followUpOn: date,
      activity: withActivity(lead, entry('follow_up', date ? `Follow-up set for ${date}` : 'Follow-up cleared', by)),
    });
  },

  async assign(id: ID, staffId: ID | '', staffName: string, by: string): Promise<Lead> {
    const lead = await getLead(id);
    return repositories.leads.update(id, {
      assignedTo: staffId,
      activity: withActivity(lead, entry('note', staffId ? `Assigned to ${staffName}` : 'Unassigned', by)),
    });
  },

  async addNote(id: ID, kind: 'note' | 'call', text: string, by: string): Promise<Lead> {
    if (!text.trim()) throw new DomainError('Write the note first.');
    const lead = await getLead(id);
    const next: Partial<Lead> = { activity: withActivity(lead, entry(kind, text.trim(), by)) };
    if (kind === 'call' && lead.status === 'new') next.status = 'contacted';
    return repositories.leads.update(id, next);
  },

  /** Makes the lead's personal booking link, reusing the one it already has. */
  async generateLink(id: ID, by: string): Promise<{ lead: Lead; url: string; created: boolean }> {
    let lead = await getLead(id);
    if (lead.status === 'converted' || lead.status === 'lost') {
      throw new DomainError(lead.status === 'converted' ? 'This lead has already booked.' : 'This lead is marked Lost. Reopen it first to send a booking link.');
    }
    const created = !lead.bookingToken;
    if (created) {
      lead = await repositories.leads.update(id, {
        bookingToken: makeToken(),
        linkCreatedAt: new Date().toISOString(),
        activity: withActivity(lead, entry('link', 'Personal booking link generated', by)),
      });
    }
    return { lead, url: leadService.linkUrl(lead.bookingToken), created };
  },

  linkUrl: (token: string) => `${window.location.origin}/book/${token}`,

  /** Records that a message was prepared for a lead. Moves a brand-new lead to Contacted. */
  async logContact(id: ID, channel: MessageChannel, templateName: string, by: string): Promise<void> {
    const lead = await getLead(id);
    await repositories.leads.update(id, {
      status: lead.status === 'new' ? 'contacted' : lead.status,
      activity: withActivity(lead, entry(channel, `${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} prepared: ${templateName}`, by)),
    });
  },

  /** Ties a lead to the booking made for it, which is what makes it Converted. */
  async linkReservation(id: ID, reservationId: ID, how: string, by: string): Promise<Lead> {
    const lead = await getLead(id);
    const reservation = await repositories.reservations.get(reservationId);
    if (!reservation) throw new DomainError('That booking no longer exists.');
    return repositories.leads.update(id, {
      status: 'converted',
      reservationId,
      convertedAt: new Date().toISOString(),
      followUpOn: '',
      lostReason: '',
      activity: withActivity(lead, entry('booking', `Booking ${reservation.code} made${how}`, by)),
    });
  },
};

/* ---------- The public booking link ---------- */

export interface PublicOffer {
  hotel: { name: string; tagline: string; city: string; phone: string };
  guestFirstName: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  categoryId: ID | '';
  budget: number;
  bookedCode: string | null;
  categories: { id: ID; name: string; description: string; basePrice: number; capacity: number; bed: string; view: string }[];
}

async function leadByToken(token: string): Promise<Lead | undefined> {
  if (!TOKEN_PATTERN.test(token)) return undefined;
  return (await repositories.leads.list()).find((l) => l.bookingToken === token);
}

/**
 * What the guest's booking page may do. It learns the hotel, the guest's first name and their own
 * enquiry details, and nothing about other leads. With a real backend these are the calls to turn into
 * endpoints, and every check below must move server side with them.
 */
export const publicLeadService = {
  async offer(token: string): Promise<PublicOffer | null> {
    const lead = await leadByToken(token);
    if (!lead) return null;
    const [[hotel], categories] = await Promise.all([repositories.hotels.list(), repositories.roomCategories.list()]);
    if (!lead.linkOpenedAt) {
      await repositories.leads.update(lead.id, {
        linkOpenedAt: new Date().toISOString(),
        activity: withActivity(lead, entry('link_opened', 'The guest opened the booking link', 'System')),
      });
    }
    const booked = lead.reservationId ? await repositories.reservations.get(lead.reservationId) : undefined;
    return {
      hotel: { name: hotel.name, tagline: hotel.tagline, city: hotel.city, phone: hotel.phone },
      guestFirstName: lead.name.split(' ')[0],
      checkIn: lead.checkIn,
      checkOut: lead.checkOut,
      adults: lead.adults,
      categoryId: lead.categoryId,
      budget: lead.budget,
      bookedCode: booked && !['cancelled', 'no_show'].includes(booked.status) ? booked.code : null,
      categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description, basePrice: c.basePrice, capacity: c.capacity, bed: c.bed, view: c.view })),
    };
  },

  async book(token: string, input: { categoryId: ID; checkIn: string; checkOut: string; adults: number; notes: string }): Promise<{ code: string }> {
    const lead = await leadByToken(token);
    if (!lead) throw new DomainError('This booking link is not valid. Please ask the hotel for a new one.');
    if (lead.reservationId) {
      const existing = await repositories.reservations.get(lead.reservationId);
      if (existing && !['cancelled', 'no_show'].includes(existing.status)) return { code: existing.code };
    }
    if (input.checkIn < today()) throw new DomainError('Choose today or a later check-in date.');
    const category = await repositories.roomCategories.get(input.categoryId);
    if (!category) throw new DomainError('Choose a room type.');
    const [first, ...rest] = lead.name.trim().split(/\s+/);
    const guest = await guestService.findOrCreateByEmail({
      ...emptyGuest(),
      firstName: first,
      lastName: rest.join(' '),
      email: lead.email,
      phone: lead.phone,
      nationality: '',
    });
    const reservation = await reservationService.create({
      guestId: guest.id,
      categoryId: category.id,
      roomId: null,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: 0,
      source: 'lead_link',
      ratePerNight: category.basePrice,
      notes: input.notes.trim().slice(0, 500),
      status: 'pending',
    });
    const fresh = await getLead(lead.id);
    await repositories.leads.update(lead.id, {
      status: 'converted',
      reservationId: reservation.id,
      convertedAt: new Date().toISOString(),
      followUpOn: '',
      lostReason: '',
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      categoryId: category.id,
      activity: withActivity(fresh, entry('booking', `Booking ${reservation.code} requested through the booking link`, 'Guest')),
    });
    await activityService.log(`${lead.name} booked through their link (${reservation.code})`, 'success', `/app/reservations?open=${reservation.id}`);
    return { code: reservation.code };
  },
};

/* ---------- Templates ---------- */

export interface TemplateInput {
  channel: MessageChannel;
  name: string;
  subject: string;
  body: string;
}

function checkTemplate(input: TemplateInput) {
  if (!input.name.trim()) throw new DomainError('Give the template a name.');
  if (input.channel === 'email' && !input.subject.trim()) throw new DomainError('An email template needs a subject line.');
  if (!input.body.trim()) throw new DomainError('Write the message first.');
  const unknown = unknownVariables(`${input.subject}\n${input.body}`);
  if (unknown.length) throw new DomainError(`Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `{${u}}`).join(', ')}. Check the spelling, or pick from the list.`);
}

export const templateService = {
  async list(): Promise<MessageTemplate[]> {
    return (await repositories.messageTemplates.list()).sort((a, b) => Number(!!b.builtInKey) - Number(!!a.builtInKey));
  },

  async create(input: TemplateInput): Promise<MessageTemplate> {
    checkTemplate(input);
    return repositories.messageTemplates.create({
      id: newId('tpl'),
      channel: input.channel,
      builtInKey: '',
      name: input.name.trim(),
      subject: input.channel === 'email' ? input.subject.trim() : '',
      body: input.body.trim(),
      updatedAt: new Date().toISOString(),
    });
  },

  async update(id: ID, input: Omit<TemplateInput, 'channel'>): Promise<MessageTemplate> {
    const current = await repositories.messageTemplates.get(id);
    if (!current) throw new DomainError('That template no longer exists.');
    checkTemplate({ ...input, channel: current.channel });
    return repositories.messageTemplates.update(id, {
      // A built-in keeps its name, so it can always be told apart and restored.
      name: current.builtInKey ? current.name : input.name.trim(),
      subject: current.channel === 'email' ? input.subject.trim() : '',
      body: input.body.trim(),
      updatedAt: new Date().toISOString(),
    });
  },

  async remove(id: ID) {
    const current = await repositories.messageTemplates.get(id);
    if (!current) return;
    if (current.builtInKey) throw new DomainError('Built-in templates cannot be deleted. Edit it, or restore the original wording.');
    await repositories.messageTemplates.remove(id);
  },

  /** Puts a built-in template's original wording back. */
  async restore(id: ID): Promise<MessageTemplate> {
    const current = await repositories.messageTemplates.get(id);
    const seed = current && TEMPLATE_SEEDS.find((s) => s.key === current.builtInKey);
    if (!current || !seed) throw new DomainError('Only built-in templates have original wording to restore.');
    const original = buildTemplates(today()).find((t) => t.id === id);
    return repositories.messageTemplates.update(id, { subject: original?.subject ?? '', body: original?.body ?? '', updatedAt: new Date().toISOString() });
  },
};

/* ---------- Communication history ---------- */

export const communicationService = {
  async list(): Promise<CommunicationLog[]> {
    return (await repositories.communications.list()).sort((a, b) => b.at.localeCompare(a.at));
  },

  async log(input: Omit<CommunicationLog, 'id' | 'at'>): Promise<void> {
    await repositories.communications.create({ ...input, id: newId('comm'), at: new Date().toISOString() });
    if (input.leadId) await leadService.logContact(input.leadId, input.channel, input.templateName, input.by);
  },
};
