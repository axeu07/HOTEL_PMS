import { whatsappNumber } from '@/lib/phone';
import { isEmail } from '@/lib/validation';
import type { MessageChannel } from '@/types/domain';

export type OutreachLink = { ok: true; href: string } | { ok: false; reason: string };

/**
 * The address WhatsApp or the mail app opens with the message already written. Staff read it and press
 * Send there. Nothing is sent from this app, so nothing in it says a message was delivered.
 */
export function outreachLink(
  channel: MessageChannel,
  contact: { name: string; phone?: string; email?: string },
  message: string,
  subject: string,
  defaultCountryCode = '91',
): OutreachLink {
  if (channel === 'whatsapp') {
    if (!contact.phone?.trim()) return { ok: false, reason: `${contact.name} has no phone number saved.` };
    const number = whatsappNumber(contact.phone, defaultCountryCode);
    if (!number) return { ok: false, reason: `The phone number for ${contact.name} (${contact.phone}) does not look valid for WhatsApp.` };
    return { ok: true, href: `https://wa.me/${number}?text=${encodeURIComponent(message)}` };
  }
  if (!contact.email?.trim()) return { ok: false, reason: `${contact.name} has no email address saved.` };
  if (!isEmail(contact.email)) return { ok: false, reason: `The email for ${contact.name} (${contact.email}) does not look valid.` };
  return { ok: true, href: `mailto:${encodeURIComponent(contact.email.trim()).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}` };
}
