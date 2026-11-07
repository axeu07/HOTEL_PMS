import type { MessageChannel } from '@/types/domain';

/** The placeholders a template may use, in the order they are offered in the editor. */
export const TEMPLATE_VARIABLES = [
  { key: 'guest_name', label: 'Guest name', sample: 'Priya' },
  { key: 'hotel_name', label: 'Hotel name', sample: 'Vasanta Court' },
  { key: 'room_type', label: 'Room type', sample: 'Lake View Room' },
  { key: 'price', label: 'Price per night', sample: '₹6,500' },
  { key: 'booking_link', label: 'Booking link', sample: 'https://…/book/ab12cd34' },
  { key: 'check_in', label: 'Check-in date', sample: '12 Dec 2026' },
  { key: 'check_out', label: 'Check-out date', sample: '15 Dec 2026' },
  { key: 'hotel_phone', label: 'Hotel phone', sample: '+91 135 000 0000' },
  { key: 'staff_name', label: 'Your name', sample: 'Tara' },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]['key'];
export type TemplateValues = Partial<Record<TemplateVariable, string>>;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));

/** Fills `{placeholders}`. One with no value is left visible, so staff notice it before sending. */
export function renderTemplate(text: string, values: TemplateValues): string {
  return text.replace(/\{([a-z_]+)\}/g, (whole, key: string) => {
    const value = KNOWN.has(key) ? values[key as TemplateVariable] : undefined;
    return value ? value : whole;
  });
}

/** Placeholders in the text that this app does not know, so the editor can warn about typos. */
export function unknownVariables(text: string): string[] {
  return [...new Set([...text.matchAll(/\{([a-zA-Z_]+)\}/g)].map((m) => m[1]).filter((k) => !KNOWN.has(k)))];
}

export interface TemplateSeed {
  key: string;
  name: string;
  /** When to use it. */
  when: string;
  whatsapp: string;
  emailSubject: string;
  email: string;
}

const SIGN = '\n\nWarm regards,\n{staff_name}\n{hotel_name}\n{hotel_phone}';

export const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    key: 'welcome',
    name: 'Welcome message',
    when: 'First contact with a new guest or lead.',
    whatsapp: 'Hello {guest_name}! Welcome to {hotel_name}. Thank you for getting in touch. I am {staff_name} and I will be happy to help you plan your stay. Tell me your dates and I will suggest the best room for you.',
    emailSubject: 'Welcome to {hotel_name}',
    email: 'Dear {guest_name},\n\nWelcome to {hotel_name}, and thank you for your interest in staying with us.\n\nWe would be delighted to help you plan your visit. Please share your preferred dates and the number of guests, and we will suggest the room that suits you best.' + SIGN,
  },
  {
    key: 'enquiry_follow_up',
    name: 'New enquiry follow-up',
    when: 'Within a day of an enquiry arriving.',
    whatsapp: 'Hello {guest_name}, this is {staff_name} from {hotel_name}. Thank you for your enquiry. A {room_type} is available for {check_in} to {check_out} at {price} per night. You can reserve it here: {booking_link}',
    emailSubject: 'Your enquiry with {hotel_name}',
    email: 'Dear {guest_name},\n\nThank you for your enquiry. We have a {room_type} available from {check_in} to {check_out} at {price} per night.\n\nYou can review the details and reserve your stay here:\n{booking_link}\n\nIf you would like a different room or dates, just reply to this message.' + SIGN,
  },
  {
    key: 'room_offer',
    name: 'Special room offer',
    when: 'Offer a particular room at a special rate.',
    whatsapp: 'Hello {guest_name}! We have a special offer for you at {hotel_name}: our {room_type} at {price} per night. Rooms are limited. Reserve here: {booking_link}',
    emailSubject: 'A special offer on our {room_type}',
    email: 'Dear {guest_name},\n\nWe are pleased to offer you our {room_type} at a special rate of {price} per night.\n\nAvailability is limited, so we recommend booking early:\n{booking_link}' + SIGN,
  },
  {
    key: 'seasonal',
    name: 'Seasonal discount',
    when: 'Festival, holiday or low-season campaigns.',
    whatsapp: 'Hello {guest_name}! The season is here at {hotel_name}. Enjoy our seasonal rate on the {room_type}, from {price} per night, for a limited time. Book here: {booking_link}',
    emailSubject: 'Our seasonal offer is here',
    email: 'Dear {guest_name},\n\nThe season is a lovely time to be with us. For a limited period, enjoy our seasonal rate on the {room_type}, from {price} per night.\n\nTo reserve your dates:\n{booking_link}\n\nWe would love to welcome you.' + SIGN,
  },
  {
    key: 'booking_reminder',
    name: 'Booking reminder',
    when: 'Before arrival, or while a booking is unconfirmed.',
    whatsapp: 'Hello {guest_name}, a gentle reminder about your stay at {hotel_name} from {check_in} to {check_out}. Please let us know your arrival time, and call us on {hotel_phone} if you need anything.',
    emailSubject: 'Your upcoming stay at {hotel_name}',
    email: 'Dear {guest_name},\n\nThis is a friendly reminder about your stay with us from {check_in} to {check_out}.\n\nIf you can share your expected arrival time, we will have everything ready. For any change, please call us on {hotel_phone}.' + SIGN,
  },
  {
    key: 'abandoned_enquiry',
    name: 'Abandoned enquiry follow-up',
    when: 'A lead went quiet after asking about rates.',
    whatsapp: 'Hello {guest_name}, you were looking at the {room_type} at {hotel_name}. It is still available for {check_in} to {check_out} at {price} per night. Shall I hold it for you? {booking_link}',
    emailSubject: 'Still thinking about your stay?',
    email: 'Dear {guest_name},\n\nYou recently asked about the {room_type}, and we wanted to let you know it is still available from {check_in} to {check_out} at {price} per night.\n\nIf it helps, we can answer any questions or suggest alternatives. You can also reserve directly:\n{booking_link}' + SIGN,
  },
  {
    key: 'vip_offer',
    name: 'Returning guest / VIP offer',
    when: 'Thank loyal guests and invite them back.',
    whatsapp: 'Dear {guest_name}, thank you for being such a valued guest of {hotel_name}. As a thank-you, we are keeping our {room_type} for you at {price} per night. Book your next stay: {booking_link}',
    emailSubject: 'A thank-you from {hotel_name}',
    email: 'Dear {guest_name},\n\nIt has been a pleasure to host you, and we would love to welcome you back.\n\nAs a thank-you for your loyalty, we are pleased to offer you our {room_type} at {price} per night.\n\nReserve your next stay:\n{booking_link}' + SIGN,
  },
  {
    key: 'birthday',
    name: 'Birthday wishes',
    when: 'Around a guest’s birthday.',
    whatsapp: 'Happy Birthday, {guest_name}! Everyone at {hotel_name} wishes you a wonderful year. Celebrate with us: enjoy the {room_type} at {price} per night this month. {booking_link}',
    emailSubject: 'Happy Birthday from {hotel_name}',
    email: 'Dear {guest_name},\n\nEveryone at {hotel_name} wishes you a very happy birthday.\n\nTo help you celebrate, we would love to host you in our {room_type} at a special {price} per night this month:\n{booking_link}' + SIGN,
  },
];

export const CHANNEL_LABEL: Record<MessageChannel, string> = { whatsapp: 'WhatsApp', email: 'Email' };
