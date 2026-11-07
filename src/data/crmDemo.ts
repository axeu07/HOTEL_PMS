import { renderTemplate, TEMPLATE_SEEDS, type TemplateValues } from '@/domain/templates';
import { addDays, nightsBetween } from '@/lib/dates';
import { money } from '@/lib/format';
import type {
  CommunicationLog,
  Guest,
  GuestOccasion,
  Hotel,
  Lead,
  LeadActivity,
  LeadActivityKind,
  LeadSource,
  LeadStatus,
  MessageTemplate,
  OccasionType,
  Reservation,
  RoomCategory,
} from '@/types/domain';
import { FIRST_NAMES, LAST_NAMES } from './fixtures';

/*
 * Sample customer-relationship data. Every lead, message and campaign below is invented; nothing is
 * pulled from Meta, Instagram or any booking platform, and the app does not claim otherwise.
 * It has its own random sequence, so adding or changing it never moves the hotel's other sample data.
 */

function rng(seed: number) {
  let s = seed;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  };
}

const SOURCE_WEIGHTS: [LeadSource, number][] = [
  ['meta', 22], ['instagram', 15], ['ota', 18], ['website', 15], ['walk_in', 6], ['call', 9], ['manual', 3], ['other', 4],
];

const SOURCE_DETAIL: Record<LeadSource, string[]> = {
  meta: ['Facebook lead ad · Lakeside weekend', 'Facebook Messenger enquiry', 'Facebook lead ad · Winter offer'],
  instagram: ['Instagram message', 'Instagram story reply', 'Instagram reel ad'],
  ota: ['MakeMyTrip enquiry', 'Booking.com message', 'Goibibo enquiry', 'Agoda message'],
  website: ['Website contact form', 'Website “Check dates” request'],
  walk_in: ['Asked at the front desk'],
  call: ['Phone enquiry'],
  manual: ['Added by staff'],
  other: ['Travel fair contact', 'Corporate referral', 'Newsletter sign-up'],
};

const ASSIGNEES = ['staff-3', 'staff-4', 'staff-5', 'staff-2'];
const STAFF_FIRST: Record<string, string> = { 'staff-2': 'Arjun', 'staff-3': 'Tara', 'staff-4': 'Kabir', 'staff-5': 'Nisha' };
const LOST_REASONS = ['Booked elsewhere', 'Price too high for the budget', 'Dates no longer available', 'Plans changed', 'No response after three follow-ups'];

const NOTES = [
  '',
  '',
  'Travelling with family. Wants rooms close together.',
  'Asked about breakfast and parking.',
  'Celebrating an anniversary.',
  'Prefers a lake-facing room.',
  'Wants to know about airport pickup.',
  'Corporate offsite, may need three rooms.',
];

export const MESSAGE_TEMPLATE_ID = (channel: 'whatsapp' | 'email', key: string) => `tpl-${channel === 'whatsapp' ? 'wa' : 'em'}-${key}`;

export function buildTemplates(now: string): MessageTemplate[] {
  const at = `${now}T08:00:00.000Z`;
  return TEMPLATE_SEEDS.flatMap((seed) => [
    { id: MESSAGE_TEMPLATE_ID('whatsapp', seed.key), channel: 'whatsapp' as const, builtInKey: seed.key, name: seed.name, subject: '', body: seed.whatsapp, updatedAt: at },
    { id: MESSAGE_TEMPLATE_ID('email', seed.key), channel: 'email' as const, builtInKey: seed.key, name: seed.name, subject: seed.emailSubject, body: seed.email, updatedAt: at },
  ]);
}

/** Birthdays for most guests, with a few falling in the next month so a birthday offer always has someone to go to. */
export function assignBirthdays(guests: Guest[], now: string): void {
  guests.forEach((guest, i) => {
    if (guest.id.startsWith('guest-demo') || i % 4 === 3) return;
    const monthDay = i % 9 === 0 ? addDays(now, (i * 5) % 28).slice(5) : addDays('2025-01-01', (i * 53) % 365).slice(5);
    guest.birthday = `${1980 + (i % 10) * 4}-${monthDay}`;
  });
}

interface Inputs {
  now: string;
  hotel: Hotel;
  guests: Guest[];
  reservations: Reservation[];
  categories: RoomCategory[];
}

export function buildCrmDemo({ now, hotel, guests, reservations, categories }: Inputs): { leads: Lead[]; communications: CommunicationLog[] } {
  const rand = rng(77310);
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const leads: Lead[] = [];
  const communications: CommunicationLog[] = [];
  let activitySeq = 1;
  let commSeq = 1;

  const token = () => Array.from({ length: 10 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[rand.int(0, 30)]).join('');
  const weighted = () => {
    const total = SOURCE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let roll = rand.next() * total;
    for (const [source, weight] of SOURCE_WEIGHTS) {
      roll -= weight;
      if (roll < 0) return source;
    }
    return 'meta' as LeadSource;
  };
  const at = (date: string, hour: number) => `${date}T${String(hour).padStart(2, '0')}:${String(rand.int(0, 59)).padStart(2, '0')}:00.000Z`;
  const act = (date: string, hour: number, kind: LeadActivityKind, text: string, by = 'System'): LeadActivity => ({
    id: `la-${activitySeq++}`,
    at: at(date, hour),
    kind,
    text,
    by,
  });
  const phone = () => `+91 98${rand.int(100, 999)} ${rand.int(10000, 99999)}`;
  const staffLabel = (id: string) => (id ? STAFF_FIRST[id] ?? 'Staff' : 'Team');

  const logMessage = (lead: Lead, channel: 'whatsapp' | 'email', key: string, date: string, hour: number) => {
    const seed = TEMPLATE_SEEDS.find((s) => s.key === key)!;
    const category = categoryById.get(lead.categoryId);
    const values: TemplateValues = {
      guest_name: lead.name.split(' ')[0],
      hotel_name: hotel.name,
      hotel_phone: hotel.phone,
      room_type: category?.name ?? 'room',
      price: money(lead.budget || category?.basePrice || 0),
      check_in: lead.checkIn,
      check_out: lead.checkOut,
      staff_name: staffLabel(lead.assignedTo),
      booking_link: lead.bookingToken ? `/book/${lead.bookingToken}` : hotel.email,
    };
    const body = renderTemplate(channel === 'whatsapp' ? seed.whatsapp : seed.email, values);
    const subject = channel === 'email' ? renderTemplate(seed.emailSubject, values) : '';
    communications.push({
      id: `comm-${commSeq++}`,
      channel,
      guestId: null,
      leadId: lead.id,
      recipient: channel === 'whatsapp' ? lead.phone : lead.email,
      templateName: seed.name,
      subject,
      body,
      at: at(date, hour),
      by: staffLabel(lead.assignedTo),
      demo: true,
    });
    lead.activity.push({ id: `la-${activitySeq++}`, at: at(date, hour), kind: channel, text: `${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} prepared: ${seed.name}`, by: staffLabel(lead.assignedTo) });
  };

  const usedNames = new Set(guests.map((g) => `${g.firstName} ${g.lastName}`.toLowerCase()));
  const freshName = () => {
    for (;;) {
      const first = rand.pick(FIRST_NAMES);
      const last = rand.pick(LAST_NAMES);
      const full = `${first} ${last}`;
      if (!usedNames.has(full.toLowerCase())) {
        usedNames.add(full.toLowerCase());
        return { first, last, full };
      }
    }
  };
  const emailFor = (first: string, last: string) => `${first}.${last}${rand.int(1, 99)}@example.com`.toLowerCase();

  const base = (): Pick<Lead, 'linkCreatedAt' | 'linkOpenedAt' | 'reservationId' | 'convertedAt' | 'lostReason' | 'bookingToken' | 'followUpOn'> => ({
    linkCreatedAt: null,
    linkOpenedAt: null,
    reservationId: null,
    convertedAt: null,
    lostReason: '',
    bookingToken: '',
    followUpOn: '',
  });

  /* Converted: real bookings from the sample story, traced back to an enquiry. */
  const eligible = reservations
    .filter((r) => ['checked_out', 'checked_in', 'confirmed'].includes(r.status) && r.createdAt.slice(0, 10) <= now && guestById.get(r.guestId)?.email)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const CONVERTED = 18;
  const step = Math.max(1, Math.floor(eligible.length / CONVERTED));
  for (let i = 0; i < CONVERTED; i++) {
    const r = eligible[Math.min(eligible.length - 1, i * step + 3)];
    const guest = guestById.get(r.guestId)!;
    const source = weighted();
    const bookedOn = r.createdAt.slice(0, 10);
    const enquiredOn = addDays(bookedOn, -rand.int(1, 6));
    const viaLink = source !== 'walk_in' && rand.chance(0.6);
    const assignedTo = rand.pick(ASSIGNEES);
    const lead: Lead = {
      ...base(),
      id: `lead-${leads.length + 1}`,
      name: `${guest.firstName} ${guest.lastName}`,
      phone: guest.phone,
      email: guest.email,
      source,
      sourceDetail: rand.pick(SOURCE_DETAIL[source]),
      enquiredAt: at(enquiredOn, rand.int(9, 20)),
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      adults: r.adults,
      categoryId: r.categoryId,
      budget: r.ratePerNight,
      notes: rand.pick(NOTES),
      status: 'converted',
      assignedTo,
      reservationId: r.id,
      convertedAt: r.createdAt,
      activity: [],
    };
    lead.activity.push(act(enquiredOn, 10, 'created', `Enquiry received: ${lead.sourceDetail}`));
    logMessage(lead, 'whatsapp', 'enquiry_follow_up', enquiredOn, 12);
    if (viaLink) {
      lead.bookingToken = token();
      lead.linkCreatedAt = at(enquiredOn, 13);
      lead.linkOpenedAt = at(bookedOn, 8);
      lead.activity.push(act(enquiredOn, 13, 'link', 'Personal booking link generated', staffLabel(assignedTo)));
      lead.activity.push(act(bookedOn, 8, 'link_opened', 'The guest opened the booking link'));
    }
    lead.activity.push(act(bookedOn, 9, 'booking', `Booking ${r.code} made${viaLink ? ' through the link' : ' by the desk'}`));
    leads.push(lead);
  }

  /* Open and lost enquiries. */
  const plan: { status: LeadStatus; count: number; ageMin: number; ageMax: number }[] = [
    { status: 'new', count: 11, ageMin: 0, ageMax: 1 },
    { status: 'contacted', count: 9, ageMin: 1, ageMax: 8 },
    { status: 'interested', count: 8, ageMin: 3, ageMax: 14 },
    { status: 'follow_up', count: 9, ageMin: 6, ageMax: 22 },
    { status: 'lost', count: 14, ageMin: 20, ageMax: 150 },
  ];
  for (const group of plan) {
    for (let i = 0; i < group.count; i++) {
      const { first, last, full } = freshName();
      const source = weighted();
      // The first few "new" leads arrive today, so the dashboard always has a "today" to show.
      const age = group.status === 'new' ? (i < 6 ? 0 : 1) : rand.int(group.ageMin, group.ageMax);
      const enquiredOn = addDays(now, -age);
      const category = rand.chance(0.75) ? rand.pick(categories) : undefined;
      const checkIn = group.status === 'lost' && rand.chance(0.5) ? addDays(enquiredOn, rand.int(10, 40)) : addDays(now, rand.int(6, 75));
      const nights = rand.int(2, 5);
      const assignedTo = group.status === 'new' && i % 3 === 0 ? '' : rand.pick(ASSIGNEES);
      const lead: Lead = {
        ...base(),
        id: `lead-${leads.length + 1}`,
        name: full,
        phone: phone(),
        email: emailFor(first, last),
        source,
        sourceDetail: rand.pick(SOURCE_DETAIL[source]),
        enquiredAt: at(enquiredOn, rand.int(8, 22)),
        checkIn,
        checkOut: addDays(checkIn, nights),
        adults: Math.min(category?.capacity ?? 2, rand.pick([1, 2, 2, 2, 3, 4])),
        categoryId: category?.id ?? '',
        budget: category ? Math.round((category.basePrice * (0.8 + rand.next() * 0.35)) / 500) * 500 : rand.pick([0, 4000, 6000, 8000]),
        notes: rand.pick(NOTES),
        status: group.status,
        assignedTo,
        activity: [],
      };
      lead.activity.push(act(enquiredOn, 9, 'created', `Enquiry received: ${lead.sourceDetail}`));

      if (group.status !== 'new') {
        const firstTouch = addDays(enquiredOn, Math.min(age, 1));
        if (rand.chance(0.7)) logMessage(lead, 'whatsapp', 'enquiry_follow_up', firstTouch, 11);
        else lead.activity.push(act(firstTouch, 11, 'call', 'Called the guest and discussed dates', staffLabel(assignedTo)));
      }
      if (group.status === 'interested' || group.status === 'follow_up') {
        lead.activity.push(act(addDays(enquiredOn, Math.min(age, 2)), 15, 'status', 'Marked as Interested', staffLabel(assignedTo)));
        if (rand.chance(0.6)) {
          lead.bookingToken = token();
          lead.linkCreatedAt = at(addDays(enquiredOn, Math.min(age, 2)), 16);
          lead.activity.push(act(addDays(enquiredOn, Math.min(age, 2)), 16, 'link', 'Personal booking link generated', staffLabel(assignedTo)));
          if (rand.chance(0.5)) {
            lead.linkOpenedAt = at(addDays(enquiredOn, Math.min(age, 3)), 21);
            lead.activity.push(act(addDays(enquiredOn, Math.min(age, 3)), 21, 'link_opened', 'The guest opened the booking link'));
          }
        }
      }
      if (group.status === 'follow_up') {
        // A spread of overdue, due today and upcoming, so the follow-up reminders have something to say.
        lead.followUpOn = addDays(now, [-3, -1, 0, 0, 1, 2, 4, -2, 3][i % 9]);
        lead.activity.push(act(addDays(now, -Math.min(age, 2)), 17, 'follow_up', `Follow-up set for ${lead.followUpOn}`, staffLabel(assignedTo)));
      }
      if (group.status === 'interested' && rand.chance(0.5)) lead.followUpOn = addDays(now, rand.int(1, 5));
      if (group.status === 'contacted' && rand.chance(0.4)) lead.followUpOn = addDays(now, rand.int(0, 3));
      if (group.status === 'lost') {
        lead.lostReason = rand.pick(LOST_REASONS);
        lead.activity.push(act(addDays(enquiredOn, Math.min(age, 9)), 14, 'status', `Marked as Lost: ${lead.lostReason}`, staffLabel(assignedTo)));
      }
      leads.push(lead);
    }
  }

  /* Earlier offers sent to past guests, so their communication history is not empty. */
  const stayed = guests.filter((g) => !g.id.startsWith('guest-demo') && g.email).slice(0, 60);
  const offers = ['vip_offer', 'seasonal', 'birthday', 'room_offer'];
  for (let i = 0; i < 14; i++) {
    const guest = stayed[(i * 7) % stayed.length];
    const seed = TEMPLATE_SEEDS.find((s) => s.key === offers[i % offers.length])!;
    const channel = i % 3 === 0 ? 'email' : 'whatsapp';
    const category = categories[i % categories.length];
    const values: TemplateValues = {
      guest_name: guest.firstName,
      hotel_name: hotel.name,
      hotel_phone: hotel.phone,
      room_type: category.name,
      price: money(category.basePrice),
      staff_name: staffLabel(ASSIGNEES[i % ASSIGNEES.length]),
      booking_link: 'our website',
    };
    const date = addDays(now, -rand.int(3, 70));
    communications.push({
      id: `comm-${commSeq++}`,
      channel,
      guestId: guest.id,
      leadId: null,
      recipient: channel === 'whatsapp' ? guest.phone : guest.email,
      templateName: seed.name,
      subject: channel === 'email' ? renderTemplate(seed.emailSubject, values) : '',
      body: renderTemplate(channel === 'whatsapp' ? seed.whatsapp : seed.email, values),
      at: at(date, 11),
      by: staffLabel(ASSIGNEES[i % ASSIGNEES.length]),
      demo: true,
    });
  }

  // Keep the stay length honest for any lead whose reservation was shortened in the sample story.
  leads.forEach((l) => {
    if (l.checkIn && l.checkOut && nightsBetween(l.checkIn, l.checkOut) < 1) l.checkOut = addDays(l.checkIn, 1);
  });

  return { leads, communications: communications.sort((a, b) => a.at.localeCompare(b.at)) };
}

/* ---------- Guest occasions ---------- */

const OCCASION_PLAN: { type: OccasionType; weight: number; notes: string[] }[] = [
  { type: 'birthday', weight: 10, notes: ['Would like a cake in the room.', 'Surprise for the family at dinner.', ''] },
  { type: 'anniversary', weight: 6, notes: ['Flowers and a quiet table, please.', 'Twenty-fifth. Champagne on arrival if possible.', ''] },
  { type: 'celebration', weight: 4, notes: ['Promotion party for the team.', 'Graduation weekend with family.', ''] },
  { type: 'family_vacation', weight: 5, notes: ['Two children, cots needed.', 'Grandparents travelling with us.', ''] },
  { type: 'other', weight: 2, notes: ['Reunion with college friends.', ''] },
];

/**
 * Sample occasions raised at booking or check-in. A fifth of the live bookings carry one, plus one
 * guest's profile-only entry, so every state of the Guest Occasions row has something to show.
 */
export function buildOccasionsDemo({ now, guests, reservations }: { now: string; guests: Guest[]; reservations: Reservation[] }): GuestOccasion[] {
  const rand = rng(90417);
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const total = OCCASION_PLAN.reduce((s, p) => s + p.weight, 0);
  const out: GuestOccasion[] = [];
  const seen = new Set<string>();
  const sorted = [...reservations]
    .filter((r) => !['cancelled', 'no_show'].includes(r.status))
    .sort((a, b) => a.code.localeCompare(b.code));

  sorted.forEach((r, i) => {
    if (i % 5 !== 2) return;
    let roll = rand.next() * total;
    const plan = OCCASION_PLAN.find((p) => (roll -= p.weight) < 0) ?? OCCASION_PLAN[0];
    const guest = guestById.get(r.guestId);
    if (!guest) return;
    const key = `${r.id}:${plan.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    const nights = Math.max(1, nightsBetween(r.checkIn, r.checkOut));
    const dated = plan.type !== 'family_vacation' || rand.chance(0.3);
    const raisedAtCheckIn = r.status === 'checked_in' || r.status === 'checked_out' ? rand.chance(0.4) : false;
    const created = (raisedAtCheckIn ? r.checkIn : r.createdAt.slice(0, 10)) + 'T09:00:00.000Z';
    out.push({
      id: `occ-${out.length + 1}`,
      guestId: r.guestId,
      reservationId: r.id,
      type: plan.type,
      date: dated ? addDays(r.checkIn, rand.int(0, nights - 1)) : '',
      celebrant: plan.type === 'birthday' || plan.type === 'anniversary' ? (rand.chance(0.5) ? guest.firstName : rand.pick(FIRST_NAMES)) : '',
      notes: rand.pick(plan.notes),
      source: raisedAtCheckIn ? 'check_in' : 'booking',
      createdAt: created,
      updatedAt: created,
      verifiedAt: raisedAtCheckIn ? created : null,
    });
  });

  // A profile-only entry for a guest with no booking attached, to show that case too.
  const solo = guests.find((g) => !out.some((o) => o.guestId === g.id) && !g.id.startsWith('guest-demo'));
  if (solo) {
    out.push({
      id: `occ-${out.length + 1}`,
      guestId: solo.id,
      reservationId: null,
      type: 'anniversary',
      date: addDays(now, 12),
      celebrant: 'Our 10th',
      notes: 'Mentioned on a call; planning to book a weekend.',
      source: 'profile',
      createdAt: `${addDays(now, -3)}T11:00:00.000Z`,
      updatedAt: `${addDays(now, -3)}T11:00:00.000Z`,
      verifiedAt: null,
    });
  }
  return out;
}
