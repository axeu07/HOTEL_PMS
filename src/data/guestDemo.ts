import { addDays } from '@/lib/dates';
import type { Guest, QrRegistration, Reservation } from '@/types/domain';

/**
 * Sample data for the walk-in lookup and the QR registration desk. All fictional. The returning
 * guest's number is the one the demo tells people to try.
 */
export const DEMO_RETURNING_PHONE = '1234567890';

export function buildReturningGuest(now: string): Guest {
  return {
    id: 'guest-returning-demo',
    firstName: 'Vikram',
    lastName: 'Rao',
    email: 'vikram.rao@example.com',
    phone: DEMO_RETURNING_PHONE,
    nationality: 'Indian',
    city: 'Bengaluru',
    company: 'Halden Consulting',
    idType: 'passport',
    idNumber: 'Z7XXXX41',
    age: 41,
    vip: false,
    preferences: {
      floor: 'high',
      bed: 'king',
      pillow: 'firm',
      dietary: 'vegetarian',
      notes: 'Quiet room away from the lift. Early tea at 6:30. Usually travels for work, sometimes with family.',
    },
    createdAt: `${addDays(now, -410)}T10:00:00.000Z`,
  };
}

/**
 * Gives the demo guest a believable stay history by lending him a few past, completed stays that do
 * not overlap. Rooms, rates and invoices come along with them, so the history is fully consistent.
 */
export function lendHistory(reservations: Reservation[], guestId: string, now: string, visits = 5): void {
  const past = reservations
    .filter((r) => r.status === 'checked_out' && r.roomId && r.checkOut <= addDays(now, -18))
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const picked: Reservation[] = [];
  for (const r of past) {
    // At least three weeks between visits, so it reads as a returning guest rather than one long stay.
    if (picked.every((p) => p.checkIn.localeCompare(addDays(r.checkOut, 21)) >= 0 || r.checkIn.localeCompare(addDays(p.checkOut, 21)) >= 0)) {
      picked.push(r);
      if (picked.length === visits) break;
    }
  }
  picked.forEach((r) => { r.guestId = guestId; });
}

/** A drawn sample ID card. Clearly marked as a sample, so nobody mistakes it for a real document. */
export function sampleIdCard(name: string, kind: string, number: string, tint: string): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 264" font-family="Arial, sans-serif">` +
    `<rect width="420" height="264" rx="16" fill="#fbf8f1"/>` +
    `<rect width="420" height="52" rx="16" fill="${tint}"/><rect y="30" width="420" height="22" fill="${tint}"/>` +
    `<text x="20" y="33" font-size="17" font-weight="700" fill="#fff">${esc(kind)}</text>` +
    `<rect x="22" y="76" width="92" height="116" rx="8" fill="#e4dfd2"/>` +
    `<circle cx="68" cy="116" r="20" fill="#c9c2b0"/><path d="M30 190c4-30 20-40 38-40s34 10 38 40z" fill="#c9c2b0"/>` +
    `<text x="134" y="94" font-size="11" fill="#7b7466">NAME</text>` +
    `<text x="134" y="116" font-size="20" font-weight="700" fill="#26302b">${esc(name)}</text>` +
    `<text x="134" y="146" font-size="11" fill="#7b7466">DOCUMENT NO.</text>` +
    `<text x="134" y="168" font-size="18" font-family="monospace" fill="#26302b">${esc(number)}</text>` +
    `<text x="210" y="240" text-anchor="middle" font-size="12" letter-spacing="3" fill="#a8412f">SAMPLE · DEMO ONLY · NOT A REAL ID</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A few submissions waiting at the desk, so the verification screen is never empty in a demo. */
export function buildDemoRegistrations(hotelId: string, nowMs: number): QrRegistration[] {
  const ago = (minutes: number) => new Date(nowMs - minutes * 60_000).toISOString();
  return [
    {
      id: 'qrreg-demo-1', hotelId, name: 'Neha Bhatt', phone: '9876501234', age: 29, idType: 'national_id',
      idDocument: sampleIdCard('Neha Bhatt', 'NATIONAL ID', 'XXXX 5521', '#2f7a5f'),
      status: 'pending', submittedAt: ago(14), submissionKey: 'demo-submission-0001', demo: true,
    },
    {
      id: 'qrreg-demo-2', hotelId, name: 'Daniel Okafor', phone: '+44 7700 900123', age: 34, idType: 'passport',
      idDocument: sampleIdCard('Daniel Okafor', 'PASSPORT', 'P4XXXX902', '#3b5f8a'),
      status: 'pending', submittedAt: ago(52), submissionKey: 'demo-submission-0002', demo: true,
    },
    {
      // Same number as the demo returning guest: verification matches the record that already exists.
      id: 'qrreg-demo-3', hotelId, name: 'Vikram Rao', phone: DEMO_RETURNING_PHONE, age: 41, idType: 'passport',
      idDocument: sampleIdCard('Vikram Rao', 'PASSPORT', 'Z7XXXX41', '#3b5f8a'),
      status: 'pending', submittedAt: ago(95), submissionKey: 'demo-submission-0003', demo: true,
    },
    {
      id: 'qrreg-demo-4', hotelId, name: 'Kavya Nair', phone: '9123456780', age: 26, idType: 'driving_licence',
      idDocument: sampleIdCard('Kavya Nair', 'DRIVING LICENCE', 'KL07 XXXX3318', '#a1732b'),
      status: 'pending', submittedAt: ago(140), submissionKey: 'demo-submission-0004', demo: true,
    },
  ];
}
