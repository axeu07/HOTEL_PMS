import { addDays, nightsBetween, today, toISODate } from '@/lib/dates';
import { SHIFT_WINDOWS } from '@/domain/attendance';
import { computeRoomTaxRate } from '@/domain/billing';
import type {
  ActivityItem,
  AttendanceRecord,
  BookingSource,
  DemoDatabase,
  DutyAssignment,
  Guest,
  GuestReview,
  HousekeepingTask,
  Invoice,
  InvoiceLine,
  MaintenanceRequest,
  Payment,
  PaymentMethod,
  Reservation,
  RestaurantOrder,
  Room,
  RoomCategory,
  Shift,
  Staff,
} from '@/types/domain';
import { assignBirthdays, buildCrmDemo, buildTemplates } from './crmDemo';
import { buildDemoRegistrations, buildReturningGuest, lendHistory } from './guestDemo';
import { DEMO_ACCOUNTS, HOTEL, MENU, ROLES, ROOM_CATEGORIES, STAFF_RECORDS, FIRST_NAMES, LAST_NAMES, CITIES, COMPANIES } from './fixtures';

/** Bump to discard stored demo data after a schema change. */
export const SEED_VERSION = 5;

/** Small seeded generator, so every reset produces the same story. */
function makeRandom(seed: number) {
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

/** A believable spread of past feedback, mostly warm, some not. Real ones arrive through the QR page. */
const REVIEW_SAMPLES: [rating: 1 | 2 | 3 | 4 | 5, comment: string][] = [
  [5, 'Beautiful courtyard and the lake view at sunrise was unforgettable. Staff remembered our names.'],
  [5, 'Spotless room, wonderful breakfast, and a very kind front desk team.'],
  [5, ''],
  [4, 'Lovely stay. Check-in was quick. Hot water took a minute to warm up.'],
  [4, 'Quiet, comfortable and well kept. Would have liked a later breakfast cut-off.'],
  [4, ''],
  [5, 'Housekeeping was thoughtful, they even left a note for our anniversary.'],
  [3, 'Good location, but our room smelled slightly damp when we arrived.'],
  [4, 'The garden suite was spacious and the staff were attentive.'],
  [2, 'Waited a long time at check-in and the room was not ready until evening.'],
  [5, 'Perfect weekend. The evening chai in the courtyard was a lovely touch.'],
  [3, ''],
  [4, 'Great value, friendly staff.'],
  [1, 'Air conditioning failed overnight and nobody answered the phone at the desk.'],
];

function buildReviews(rand: ReturnType<typeof makeRandom>, now: string): GuestReview[] {
  return REVIEW_SAMPLES.map(([rating, comment], i) => {
    const room = rand.int(1, 5) * 100 + rand.int(1, 8);
    const day = addDays(now, -(i * 3 + rand.int(0, 2)));
    const named = rand.chance(0.6);
    return {
      id: `rev-${i + 1}`,
      hotelId: HOTEL.id,
      rating,
      comment,
      guestName: named ? `${rand.pick(FIRST_NAMES)} ${rand.pick(LAST_NAMES)}` : '',
      roomNumber: rand.chance(0.8) ? String(room) : '',
      submissionKey: `seed-${i + 1}`,
      createdAt: new Date(`${day}T${String(rand.int(8, 21)).padStart(2, '0')}:${String(rand.int(0, 59)).padStart(2, '0')}:00`).toISOString(),
    };
  });
}

const HISTORY_DAYS = 120;
const FUTURE_DAYS = 45;

/** Rooms out of service in the sample story. */
const OFFLINE_ROOMS = ['103', '304'];
/** Ready rooms with no near-term bookings: one or more in most categories, for live walk-ins. */
const READY_ROOMS = ['107', '205', '305', '407', '502'];
const KEPT_OPEN = new Set([...OFFLINE_ROOMS, ...READY_ROOMS]);
const ARRIVING_ROOMS = ['108', '206', '306', '408'];

function buildRooms(categories: RoomCategory[]): Room[] {
  // Layout: floor -> how many rooms of each category, in door order.
  const layout: [number, string[]][] = [
    [1, ['cat-courtyard', 'cat-courtyard', 'cat-courtyard', 'cat-courtyard', 'cat-courtyard', 'cat-courtyard', 'cat-courtyard', 'cat-courtyard', 'cat-garden', 'cat-garden', 'cat-garden', 'cat-garden']],
    [2, ['cat-courtyard', 'cat-courtyard', 'cat-courtyard', 'cat-courtyard', 'cat-garden', 'cat-garden', 'cat-garden', 'cat-garden', 'cat-garden', 'cat-garden', 'cat-garden', 'cat-garden']],
    [3, ['cat-garden', 'cat-garden', 'cat-garden', 'cat-garden', 'cat-lake', 'cat-lake', 'cat-lake', 'cat-lake', 'cat-lake', 'cat-lake']],
    [4, ['cat-lake', 'cat-lake', 'cat-lake', 'cat-lake', 'cat-lake', 'cat-lake', 'cat-suite', 'cat-suite', 'cat-suite', 'cat-suite']],
    [5, ['cat-suite', 'cat-suite', 'cat-residence', 'cat-residence']],
  ];
  const known = new Set(categories.map((c) => c.id));
  const rooms: Room[] = [];
  for (const [floor, doors] of layout) {
    doors.forEach((categoryId, i) => {
      if (!known.has(categoryId)) return;
      const number = `${floor}${String(i + 1).padStart(2, '0')}`;
      rooms.push({
        id: `room-${number}`,
        number,
        floor,
        categoryId,
        status: 'vacant',
        cleaning: 'clean',
        priceOverride: null,
        notes: '',
      });
    });
  }
  return rooms;
}

function buildGuests(rand: ReturnType<typeof makeRandom>, now: string): Guest[] {
  const guests: Guest[] = [];
  const seen = new Set<string>();
  while (guests.length < 240) {
    const firstName = rand.pick(FIRST_NAMES);
    const lastName = rand.pick(LAST_NAMES);
    const key = `${firstName}.${lastName}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const i = guests.length;
    guests.push({
      id: `guest-${i + 1}`,
      firstName,
      lastName,
      email: `${key}@example.com`,
      phone: `+91 90000 ${String(10000 + i * 37).slice(0, 5)}`,
      nationality: rand.chance(0.82) ? 'Indian' : rand.pick(['British', 'German', 'Singaporean', 'American', 'Emirati']),
      city: rand.pick(CITIES),
      company: rand.chance(0.25) ? rand.pick(COMPANIES) : '',
      idType: rand.chance(0.7) ? 'national_id' : 'passport',
      idNumber: `XXXX-${String(1000 + i)}`,
      vip: rand.chance(0.1),
      preferences: {
        floor: rand.pick(['no_preference', 'no_preference', 'high', 'low'] as const),
        bed: rand.pick(['no_preference', 'king', 'twin'] as const),
        pillow: rand.pick(['no_preference', 'soft', 'firm', 'hypoallergenic'] as const),
        dietary: rand.pick(['none', 'none', 'vegetarian', 'vegan', 'jain', 'gluten_free'] as const),
        notes: rand.chance(0.25)
          ? rand.pick([
              'Prefers a quiet room away from the lift.',
              'Early-morning tea at 6:30.',
              'Celebrating an anniversary on repeat visits.',
              'Extra blanket on arrival.',
              'Late check-out requested whenever possible.',
            ])
          : '',
      },
      createdAt: `${addDays(now, -rand.int(30, 700))}T10:00:00.000Z`,
    });
  }
  return guests;
}

export function createSeedDatabase(): DemoDatabase {
  const rand = makeRandom(20261104);
  const now = today();
  const stamp = (date: string, hour = 11) => `${date}T${String(hour).padStart(2, '0')}:${String(rand.int(0, 59)).padStart(2, '0')}:00`;

  const categories = ROOM_CATEGORIES;
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const rooms = buildRooms(categories);
  const guests = buildGuests(rand, now);

  const reservations: Reservation[] = [];
  const sources: BookingSource[] = ['direct', 'direct', 'website', 'website', 'phone', 'agent', 'agent', 'corporate'];

  /* Walk each room's calendar, laying stays end to end with realistic gaps. */
  for (const room of rooms) {
    const category = categoryById.get(room.categoryId)!;
    let cursor = addDays(now, -HISTORY_DAYS + rand.int(0, 5));
    const horizon = addDays(now, FUTURE_DAYS);
    while (cursor < horizon) {
      const gap = rand.pick([0, 0, 0, 1, 1, 2, 3]);
      let checkIn = addDays(cursor, gap);
      const length = rand.pick([1, 2, 2, 2, 3, 3, 4, 5, 7]);
      let checkOut = addDays(checkIn, length);
      // These rooms are empty this morning with a guest due today, so the desk
      // always has arrivals it can check in straight away.
      if (ARRIVING_ROOMS.includes(room.number) && cursor <= now && checkOut >= now) {
        checkIn = now;
        checkOut = addDays(now, length);
      }
      cursor = checkOut;
      const isFuture = checkIn > now;
      // Keep these rooms open for now, so walk-ins always have somewhere to go.
      if (KEPT_OPEN.has(room.number) && checkIn <= addDays(now, 5) && checkOut >= now) continue;
      // Forward bookings thin out the further ahead you look.
      if (isFuture && rand.next() > 0.72 - nightsBetween(now, checkIn) * 0.02) continue;

      let status: Reservation['status'];
      if (checkOut < now) {
        const roll = rand.next();
        status = roll < 0.05 ? 'cancelled' : roll < 0.07 ? 'no_show' : 'checked_out';
      } else if (checkIn < now) {
        status = 'checked_in';
      } else if (checkIn === now) {
        status = 'confirmed';
      } else {
        status = rand.chance(0.14) ? 'pending' : rand.chance(0.04) ? 'cancelled' : 'confirmed';
      }
      const assigned = !isFuture || nightsBetween(now, checkIn) < 5 || rand.chance(0.5);
      const seasonal = 1 + rand.pick([-0.08, -0.04, 0, 0, 0, 0.05, 0.1]);
      // Rates climb gently over the history, so the story is of a hotel doing well.
      const trend = 1 + 0.28 * (nightsBetween(now, checkIn) / HISTORY_DAYS);
      const rate = Math.round((category.basePrice * seasonal * trend) / 100) * 100;
      const created = addDays(checkIn, -rand.int(0, 28));
      const source = rand.chance(0.06) ? 'walk_in' : rand.pick(sources);
      const children = category.capacity > 2 && rand.chance(0.2) ? 1 : 0;
      reservations.push({
        id: `res-${reservations.length + 1}`,
        code: '',
        guestId: rand.pick(guests).id,
        categoryId: room.categoryId,
        roomId: assigned ? room.id : null,
        checkIn,
        checkOut,
        adults: Math.min(category.capacity - children, rand.pick([1, 2, 2, 2, 3])),
        children,
        status,
        source: isFuture && source === 'walk_in' ? 'direct' : source,
        ratePerNight: rate,
        notes: '',
        cancelReason: status === 'cancelled' ? rand.pick(['Change of travel plans', 'Booked elsewhere', 'Flight cancelled']) : '',
        // Seeded bookings all predate today, so anything made live sorts first.
        createdAt: stamp(created >= now ? addDays(now, -1) : created, 9),
        checkedInAt: status === 'checked_in' || status === 'checked_out' ? stamp(checkIn, 14) : null,
        checkedOutAt: status === 'checked_out' ? stamp(checkOut, 10) : null,
      });
    }
  }

  // Give each stay a guest who is free for those dates, so nobody is ever in
  // two rooms at once. Some guests naturally come back, which fills their history.
  const guestFreeFrom = new Map<string, string>();
  [...reservations]
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .forEach((r) => {
      const start = rand.int(0, guests.length - 1);
      for (let i = 0; i < guests.length; i++) {
        const guest = guests[(start + i) % guests.length];
        if ((guestFreeFrom.get(guest.id) ?? '') <= r.checkIn) {
          r.guestId = guest.id;
          guestFreeFrom.set(guest.id, r.checkOut);
          return;
        }
      }
    });

  // The demo's returning guest (1234567890) arrives with a history of completed stays.
  const returningGuest = buildReturningGuest(now);
  guests.push(returningGuest);
  lendHistory(reservations, returningGuest.id, now);

  // Book codes in the order bookings were made, as a real system would.
  [...reservations]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((r, i) => {
      r.code = `VC-${String(20480 + i)}`;
    });

  /* Rooms reflect who is in them right now. */
  const inHouse = reservations.filter((r) => r.status === 'checked_in');
  const occupiedIds = new Set(inHouse.map((r) => r.roomId));
  const arrivingIds = new Set(reservations.filter((r) => r.checkIn === now && r.status === 'confirmed').map((r) => r.roomId));

  for (const room of rooms) {
    if (occupiedIds.has(room.id)) {
      room.status = 'occupied';
      room.cleaning = rand.chance(0.25) ? 'dirty' : 'clean';
    } else if (arrivingIds.has(room.id) || READY_ROOMS.includes(room.number)) {
      room.cleaning = 'clean';
    } else {
      room.cleaning = rand.chance(0.25) ? 'dirty' : 'clean';
    }
  }

  // One arriving room is still being turned around, which gives the desk a
  // realistic "not ready yet" case to show.
  const notReady = rooms.find((r) => arrivingIds.has(r.id) && r.status === 'vacant');
  if (notReady) notReady.cleaning = 'dirty';

  /* Two rooms out of service. */
  const offline = rooms.filter((r) => OFFLINE_ROOMS.includes(r.number));
  offline.forEach((room) => {
    room.status = 'maintenance';
    for (const res of reservations) {
      if (res.roomId === room.id && res.checkIn > now) res.roomId = null;
    }
  });

  /* Folios. */
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const methods: PaymentMethod[] = ['card', 'card', 'upi', 'upi', 'cash', 'bank_transfer'];
  let invoiceSeq = 1;
  let lineSeq = 1;
  const { tax } = HOTEL;

  const billable = [...reservations].sort((a, b) => a.code.localeCompare(b.code));
  for (const r of billable) {
    if (r.status === 'cancelled' || r.status === 'no_show') continue;
    const nights = nightsBetween(r.checkIn, r.checkOut);
    const taxRate = computeRoomTaxRate(r.ratePerNight, tax);
    const lines: InvoiceLine[] = [
      {
        id: `line-${lineSeq++}`,
        kind: 'room',
        description: `${categoryById.get(r.categoryId)!.name} · ${nights} night${nights === 1 ? '' : 's'}`,
        date: r.checkIn,
        quantity: nights,
        unitPrice: r.ratePerNight,
        taxRate,
        orderId: null,
      },
    ];
    if ((r.status === 'checked_out' || r.status === 'checked_in') && rand.chance(0.6)) {
      const extras = rand.int(1, 3);
      for (let i = 0; i < extras; i++) {
        const date = addDays(r.checkIn, rand.int(0, Math.max(0, nights - 1)));
        if (date > now) continue;
        if (rand.chance(0.7)) {
          lines.push({
            id: `line-${lineSeq++}`,
            kind: 'food',
            description: rand.pick(['Restaurant dinner', 'In-room dining', 'Courtyard breakfast', 'Terrace bar']),
            date,
            quantity: 1,
            unitPrice: rand.int(8, 42) * 100,
            taxRate: tax.foodRate,
            orderId: null,
          });
        } else {
          lines.push({
            id: `line-${lineSeq++}`,
            kind: 'service',
            description: rand.pick(['Laundry', 'Airport transfer', 'Spa treatment', 'Late check-out']),
            date,
            quantity: 1,
            unitPrice: rand.int(6, 45) * 100,
            taxRate: tax.serviceRate,
            orderId: null,
          });
        }
      }
    }
    const invoice: Invoice = {
      id: `inv-${r.id}`,
      number: `${HOTEL.invoicePrefix}/${r.checkIn.slice(0, 4)}/${String(invoiceSeq++).padStart(5, '0')}`,
      reservationId: r.id,
      guestId: r.guestId,
      status: 'unpaid',
      issuedOn: r.createdAt.slice(0, 10),
      lines,
    };
    const total = Math.round(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice * (1 + l.taxRate / 100), 0) * 100) / 100;
    let paid = 0;
    if (r.status === 'checked_out') {
      paid = total;
    } else if (r.status === 'checked_in') {
      paid = rand.chance(0.25) ? total : rand.chance(0.6) ? Math.round(total * 0.3) : 0;
    } else if (r.status === 'confirmed') {
      paid = rand.chance(0.45) ? Math.round(total * 0.25) : 0;
    }
    if (paid > 0) {
      const paidInFull = paid >= total;
      payments.push({
        id: `pay-${payments.length + 1}`,
        invoiceId: invoice.id,
        amount: paid,
        method: rand.pick(methods),
        reference: `TXN${100000 + payments.length}`,
        receivedOn: r.status === 'checked_out' ? r.checkOut : r.status === 'checked_in' && rand.chance(0.4) ? now : r.createdAt.slice(0, 10),
      });
      invoice.status = paidInFull ? 'paid' : 'partial';
    }
    invoices.push(invoice);
  }

  /*
   * A guest or two whose stay ended yesterday and who was never checked out: the room is still held.
   * Done after the folios, so the rest of the seeded story does not shift. Only rooms with nothing
   * due soon qualify, and only guests not staying elsewhere right now.
   */
  const guestsInHouse = new Set(inHouse.map((r) => r.guestId));
  const yesterday = addDays(now, -1);
  const holdsSoon = (roomId: string) =>
    reservations.some((r) => r.roomId === roomId && ['pending', 'confirmed', 'checked_in'].includes(r.status) && r.checkIn <= addDays(now, 2));
  reservations
    .filter((r) => r.status === 'checked_out' && r.checkOut === yesterday && r.roomId && !guestsInHouse.has(r.guestId))
    .filter((r) => {
      const room = rooms.find((x) => x.id === r.roomId)!;
      return room.status === 'vacant' && !KEPT_OPEN.has(room.number) && !arrivingIds.has(room.id) && !holdsSoon(room.id);
    })
    .slice(0, 2)
    .forEach((r) => {
      r.status = 'checked_in';
      r.checkedOutAt = null;
      const room = rooms.find((x) => x.id === r.roomId)!;
      room.status = 'occupied';
      room.cleaning = 'clean';
    });

  /* Staff, duties. */
  const staff: Staff[] = STAFF_RECORDS.map((s) => ({ ...s, joinedOn: addDays(now, -s.tenureDays) })).map(({ tenureDays: _t, ...rest }) => rest);
  const duties: DutyAssignment[] = [];
  const shifts: Shift[] = ['Morning', 'Evening', 'Night'];
  const areaByDept: Record<Staff['department'], string[]> = {
    Management: ['Duty manager'],
    'Front Office': ['Reception desk', 'Concierge', 'Night audit'],
    Housekeeping: ['Floors 1-2', 'Floors 3-4', 'Floor 5 & suites', 'Linen room'],
    'Food & Beverage': ['Saffron Room', 'Room service', 'Terrace bar'],
    Maintenance: ['Plant room', 'On call'],
  };
  for (let d = 0; d < 7; d++) {
    staff.forEach((person, i) => {
      if (!person.active || (d + i) % 6 === 5) return; // weekly day off
      duties.push({
        id: `duty-${duties.length + 1}`,
        staffId: person.id,
        date: addDays(now, d),
        shift: person.department === 'Management' || person.department === 'Housekeeping' ? 'Morning' : shifts[(i + Math.floor(d / 3)) % 3],
        area: areaByDept[person.department][(i + d) % areaByDept[person.department].length],
      });
    });
  }

  /*
   * Who turned up. Written ahead for the whole roster, so the story holds at any hour: a clock-in
   * only counts once its time has passed. Each shift has someone missing and someone late, as long
   * as it has enough people, and never anyone with a demo login.
   */
  const withLogin = new Set(DEMO_ACCOUNTS.map((u) => u.staffId));
  const attendance: AttendanceRecord[] = [];
  const shiftGroups = new Map<string, DutyAssignment[]>();
  duties.forEach((d) => {
    const key = `${d.date}|${d.shift}`;
    shiftGroups.set(key, [...(shiftGroups.get(key) ?? []), d]);
  });
  const atMinute = (date: string, time: string, offset: number) => {
    const at = new Date(`${date}T${time}:00`);
    at.setMinutes(at.getMinutes() + offset);
    return `${toISODate(at)}T${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}:00`;
  };
  for (const group of shiftGroups.values()) {
    const rankFor = new Map(group.filter((d) => !withLogin.has(d.staffId)).map((d, rank) => [d.id, rank]));
    const others = rankFor.size;
    group.forEach((duty, i) => {
      const rank = rankFor.get(duty.id);
      if (rank === 0 && others >= 3) return; // absent
      const late = rank === (others >= 3 ? 1 : 0) && others >= 2;
      attendance.push({
        id: `att-${attendance.length + 1}`,
        dutyId: duty.id,
        clockedInAt: atMinute(duty.date, SHIFT_WINDOWS[duty.shift].start, late ? 38 : (i % 12) - 6),
        reviewedAt: null,
      });
    });
  }

  /* Housekeeping board. */
  const keepers = staff.filter((s) => s.department === 'Housekeeping' && s.active);
  const tasks: HousekeepingTask[] = [];
  const addTask = (t: Omit<HousekeepingTask, 'id' | 'completedAt'>) =>
    tasks.push({ ...t, id: `task-${tasks.length + 1}`, completedAt: null });

  const departures = inHouse.filter((r) => r.checkOut === now);
  departures.forEach((r, i) => {
    addTask({
      roomId: r.roomId!,
      type: 'checkout_clean',
      date: now,
      time: '11:30',
      assigneeId: i % 4 === 3 ? null : keepers[i % keepers.length].id,
      status: 'pending',
      priority: arrivingIds.has(r.roomId) ? 'high' : 'normal',
      notes: arrivingIds.has(r.roomId) ? 'Same-day arrival. Turn around before 14:00.' : '',
    });
  });
  rooms
    .filter((r) => r.status === 'vacant' && r.cleaning === 'dirty')
    .forEach((room, i) => {
      addTask({
        roomId: room.id,
        type: 'checkout_clean',
        date: now,
        time: '09:30',
        assigneeId: keepers[i % keepers.length].id,
        status: i === 0 ? 'in_progress' : 'pending',
        priority: arrivingIds.has(room.id) ? 'high' : 'normal',
        notes: arrivingIds.has(room.id) ? 'Guest arriving today.' : '',
      });
      if (i === 0) room.cleaning = 'in_progress';
    });
  rooms
    .filter((r) => r.status === 'occupied' && r.cleaning === 'dirty' && !departures.some((d) => d.roomId === r.id))
    .slice(0, 10)
    .forEach((room, i) => {
      addTask({
        roomId: room.id,
        type: 'stayover',
        date: now,
        time: i % 2 ? '12:30' : '10:30',
        assigneeId: keepers[(i + 1) % keepers.length].id,
        status: 'pending',
        priority: 'low',
        notes: '',
      });
    });
  rooms
    .filter((r) => r.status === 'vacant' && r.cleaning === 'clean')
    .slice(0, 3)
    .forEach((room, i) => {
      addTask({
        roomId: room.id,
        type: 'deep_clean',
        date: addDays(now, 1 + i),
        time: '10:00',
        assigneeId: i === 2 ? null : keepers[i % keepers.length].id,
        status: 'pending',
        priority: 'normal',
        notes: 'Quarterly deep clean: curtains, grout, mattress rotation.',
      });
    });

  /* Maintenance. */
  const engineer = staff.find((s) => s.department === 'Maintenance')!;
  const maintenance: MaintenanceRequest[] = [];
  if (offline[0]) {
    maintenance.push({
      id: 'mnt-1',
      roomId: offline[0].id,
      title: 'Bathroom leak behind vanity',
      description: 'Water pooling under the vanity unit. Supply isolated, plumber needed.',
      priority: 'high',
      status: 'in_progress',
      reportedBy: 'Lata Bisht',
      assigneeId: engineer.id,
      roomOffline: true,
      createdAt: stamp(addDays(now, -1), 16),
      resolvedAt: null,
    });
  }
  if (offline[1]) {
    maintenance.push({
      id: 'mnt-2',
      roomId: offline[1].id,
      title: 'Air-conditioning not cooling',
      description: 'Compressor trips within minutes. Replacement part on order.',
      priority: 'normal',
      status: 'open',
      reportedBy: 'Rohan Negi',
      assigneeId: null,
      roomOffline: true,
      createdAt: stamp(now, 8),
      resolvedAt: null,
    });
  }
  const someOccupied = rooms.filter((r) => r.status === 'occupied');
  [
    { title: 'Bedside lamp flickering', description: 'Guest reported a loose fitting.', priority: 'low' as const, status: 'open' as const },
    { title: 'Balcony door sticks', description: 'Needs rehanging. Can wait until the room is vacant.', priority: 'low' as const, status: 'open' as const },
    { title: 'Television remote replaced', description: 'Unresponsive remote swapped for a new one.', priority: 'low' as const, status: 'resolved' as const },
  ].forEach((item, i) => {
    maintenance.push({
      id: `mnt-${maintenance.length + 1}`,
      roomId: someOccupied[(i + 1) * 3].id,
      ...item,
      reportedBy: 'Front desk',
      assigneeId: item.status === 'resolved' ? engineer.id : null,
      roomOffline: false,
      createdAt: stamp(addDays(now, -i), 12),
      resolvedAt: item.status === 'resolved' ? stamp(now, 9) : null,
    });
  });

  /* Restaurant. */
  const orderStatuses: RestaurantOrder['status'][] = ['new', 'new', 'preparing', 'preparing', 'ready', 'delivered', 'delivered', 'delivered'];
  const orders: RestaurantOrder[] = orderStatuses.map((status, i) => {
    const count = rand.int(1, 3);
    const chosen = new Set<number>();
    while (chosen.size < count) chosen.add(rand.int(0, MENU.length - 1));
    const items = [...chosen].map((idx) => ({
      menuItemId: MENU[idx].id,
      name: MENU[idx].name,
      quantity: rand.int(1, 2),
      unitPrice: MENU[idx].price,
    }));
    const stay = inHouse[i * 2];
    const isRoom = i % 4 !== 3;
    return {
      id: `ord-${i + 1}`,
      code: `KOT-${String(3100 + i)}`,
      type: isRoom ? ('room_service' as const) : ('dining_room' as const),
      reservationId: stay ? stay.id : null,
      tableLabel: isRoom ? '' : `Table ${rand.int(1, 18)}`,
      items,
      status,
      notes: i === 0 ? 'No onion or garlic, please.' : '',
      postedInvoiceId: null,
      createdAt: new Date(Date.now() - (orderStatuses.length - i) * 22 * 60_000).toISOString(),
    };
  });

  const activity: ActivityItem[] = [
    { message: 'Website booking request awaiting confirmation', tone: 'warning', link: '/app/reservations?status=pending' },
    { message: `${departures.length} departures due before ${HOTEL.checkOutTime}`, tone: 'info', link: '/app/front-desk' },
    { message: 'Maintenance logged: air-conditioning not cooling', tone: 'warning', link: '/app/housekeeping?tab=maintenance' },
    { message: 'Night audit closed with no exceptions', tone: 'success', link: '/app/reports' },
  ].map((a, i) => ({
    id: `act-${i + 1}`,
    ...(a as Pick<ActivityItem, 'message' | 'tone' | 'link'>),
    at: new Date(Date.now() - (i + 1) * 47 * 60_000).toISOString(),
    read: i > 2,
  }));

  // Random draws can leave a day with no VIP due. A manager should always have one to prepare for.
  const welcomed = reservations.find((r) => r.checkIn === now && r.status === 'confirmed' && rooms.some((x) => x.id === r.roomId && x.status === 'vacant' && x.cleaning === 'clean'));
  const vipGuest = guests.find((g) => g.id === welcomed?.guestId);
  if (vipGuest) vipGuest.vip = true;

  // Customer-relationship sample data has its own random sequence, so it never moves the story above.
  assignBirthdays(guests, now);
  const crm = buildCrmDemo({ now, hotel: HOTEL, guests, reservations, categories });

  return {
    hotels: [HOTEL],
    roles: ROLES,
    users: DEMO_ACCOUNTS,
    roomCategories: categories,
    rooms,
    guests,
    reservations,
    invoices,
    payments,
    housekeepingTasks: tasks,
    maintenanceRequests: maintenance,
    menuItems: MENU,
    restaurantOrders: orders,
    staff,
    duties,
    attendance,
    activity,
    guestReviews: buildReviews(rand, now),
    qrRegistrations: buildDemoRegistrations(HOTEL.id, Date.now()),
    leads: crm.leads,
    messageTemplates: buildTemplates(now),
    communications: crm.communications,
  };
}
