import { isEmail } from '@/lib/validation';
import { whatsappNumber } from '@/lib/phone';

export interface BillSummary {
  hotelName: string;
  hotelPhone?: string;
  guestFirstName: string;
  invoiceNumber: string;
  stay?: string;
  total: string;
  paid: string;
  balance: string;
  balanceDue: boolean;
}

/** Plain text, so it reads the same in WhatsApp and in a mail app. */
export function billMessage(b: BillSummary): string {
  const lines = [
    `Hello ${b.guestFirstName || 'there'},`,
    '',
    `Thank you for staying with ${b.hotelName}. Here is a summary of your bill.`,
    '',
    `Invoice: ${b.invoiceNumber}`,
    ...(b.stay ? [`Stay: ${b.stay}`] : []),
    `Total: ${b.total}`,
    `Paid: ${b.paid}`,
    b.balanceDue ? `Balance due: ${b.balance}` : 'Balance due: nil. This bill is settled.',
    '',
    `For a copy of the full tax invoice, please reply to this message${b.hotelPhone ? ` or call us on ${b.hotelPhone}` : ''}.`,
    '',
    `Warm regards,`,
    b.hotelName,
  ];
  return lines.join('\n');
}

export const billSubject = (hotelName: string, invoiceNumber: string) => `Your bill from ${hotelName} · ${invoiceNumber}`;

export type ShareChannel = 'whatsapp' | 'email';

export type ShareLink = { ok: true; href: string } | { ok: false; reason: string };

/** The link a share button opens, or the reason there is none. Nothing is sent from here. */
export function shareLink(
  channel: ShareChannel,
  contact: { name: string; phone?: string; email?: string },
  message: string,
  subject: string,
  defaultCountryCode = '91',
): ShareLink {
  if (channel === 'whatsapp') {
    if (!contact.phone?.trim()) return { ok: false, reason: `${contact.name} has no phone number saved, so the bill cannot be shared on WhatsApp. Add one on the guest profile.` };
    const number = whatsappNumber(contact.phone, defaultCountryCode);
    if (!number) return { ok: false, reason: `The phone number saved for ${contact.name} (${contact.phone}) does not look valid for WhatsApp. Please correct it on the guest profile.` };
    return { ok: true, href: `https://wa.me/${number}?text=${encodeURIComponent(message)}` };
  }
  if (!contact.email?.trim()) return { ok: false, reason: `${contact.name} has no email address saved, so the bill cannot be emailed. Add one on the guest profile.` };
  if (!isEmail(contact.email)) return { ok: false, reason: `The email saved for ${contact.name} (${contact.email}) does not look valid. Please correct it on the guest profile.` };
  return { ok: true, href: `mailto:${encodeURIComponent(contact.email.trim()).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}` };
}
