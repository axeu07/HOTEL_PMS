import { addDays, nightsBetween, rangeDays, today } from '@/lib/dates';
import { repositories } from '@/repositories';
import type {
  BookingSource,
  ID,
  Invoice,
  ISODate,
  Reservation,
  Room,
  RoomCategory,
} from '@/types/domain';

export interface DayRevenue {
  date: ISODate;
  room: number;
  food: number;
  service: number;
  total: number;
}

export interface DayOccupancy {
  date: ISODate;
  occupied: number;
  percent: number;
}

export interface DashboardSnapshot {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  maintenanceRooms: number;
  dirtyRooms: number;
  arrivalsToday: number;
  arrivalsDone: number;
  departuresToday: number;
  departuresDone: number;
  activeReservations: number;
  occupancyPercent: number;
  revenue30: number;
  revenuePrevious30: number;
  adr: number;
  revpar: number;
}

const COUNTS_AS_STAY: Reservation['status'][] = ['confirmed', 'checked_in', 'checked_out'];
const TREND_DAYS = 30;

/** Revenue is recognised per night stayed, not when a booking is taken or paid. */
export function revenueByDay(invoices: Invoice[], reservations: Reservation[], from: ISODate, to: ISODate): DayRevenue[] {
  const days = new Map<ISODate, DayRevenue>(
    rangeDays(from, to).map((date) => [date, { date, room: 0, food: 0, service: 0, total: 0 }]),
  );
  const statusById = new Map(reservations.map((r) => [r.id, r.status]));
  for (const invoice of invoices) {
    const status = statusById.get(invoice.reservationId);
    if (invoice.status === 'void' || !status || !['checked_in', 'checked_out'].includes(status)) continue;
    for (const line of invoice.lines) {
      if (line.kind === 'room') {
        for (let n = 0; n < line.quantity; n++) {
          const day = days.get(addDays(line.date, n));
          if (day) {
            day.room += line.unitPrice;
            day.total += line.unitPrice;
          }
        }
      } else {
        const day = days.get(line.date);
        if (day) {
          const amount = line.quantity * line.unitPrice;
          day[line.kind] += amount;
          day.total += amount;
        }
      }
    }
  }
  return [...days.values()];
}

export function occupancyByDay(reservations: Reservation[], roomCount: number, from: ISODate, to: ISODate): DayOccupancy[] {
  const days = new Map<ISODate, number>(rangeDays(from, to).map((d) => [d, 0]));
  for (const r of reservations) {
    if (!COUNTS_AS_STAY.includes(r.status)) continue;
    const nights = nightsBetween(r.checkIn, r.checkOut);
    for (let n = 0; n < nights; n++) {
      const date = addDays(r.checkIn, n);
      if (days.has(date)) days.set(date, days.get(date)! + 1);
    }
  }
  return [...days.entries()].map(([date, occupied]) => ({
    date,
    occupied,
    percent: roomCount ? Math.min(100, (occupied / roomCount) * 100) : 0,
  }));
}

export function snapshot(rooms: Room[], reservations: Reservation[], invoices: Invoice[]): DashboardSnapshot {
  const now = today();
  const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length;
  const maintenanceRooms = rooms.filter((r) => r.status === 'maintenance').length;
  const arrivals = reservations.filter((r) => r.checkIn === now && ['confirmed', 'pending', 'checked_in'].includes(r.status));
  const departures = reservations.filter((r) => r.checkOut === now && ['checked_in', 'checked_out'].includes(r.status));
  // Rolling windows of completed days stay meaningful on any date, unlike
  // month-to-date on the 1st, and today's unfinished night cannot skew the trend.
  const yesterday = addDays(now, -1);
  const windowStart = addDays(now, -TREND_DAYS);
  const current = revenueByDay(invoices, reservations, windowStart, yesterday);
  const previous = revenueByDay(invoices, reservations, addDays(windowStart, -TREND_DAYS), addDays(windowStart, -1));
  const roomRevenue = current.reduce((s, d) => s + d.room, 0);
  const occupiedNights = occupancyByDay(reservations, rooms.length, windowStart, yesterday).reduce((s, d) => s + d.occupied, 0);
  return {
    totalRooms: rooms.length,
    availableRooms: rooms.filter((r) => r.status === 'vacant' && r.cleaning === 'clean').length,
    occupiedRooms,
    maintenanceRooms,
    dirtyRooms: rooms.filter((r) => r.status === 'vacant' && r.cleaning !== 'clean').length,
    arrivalsToday: arrivals.length,
    arrivalsDone: arrivals.filter((r) => r.status === 'checked_in').length,
    departuresToday: departures.length,
    departuresDone: departures.filter((r) => r.status === 'checked_out').length,
    activeReservations: reservations.filter((r) => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length,
    occupancyPercent: rooms.length ? (occupiedRooms / rooms.length) * 100 : 0,
    revenue30: current.reduce((s, d) => s + d.total, 0),
    revenuePrevious30: previous.reduce((s, d) => s + d.total, 0),
    adr: occupiedNights ? roomRevenue / occupiedNights : 0,
    revpar: rooms.length ? roomRevenue / (rooms.length * TREND_DAYS) : 0,
  };
}

export interface ReportData {
  revenue: DayRevenue[];
  occupancy: DayOccupancy[];
  bookings: { total: number; cancelled: number; noShow: number; nights: number; averageStay: number };
  bySource: { source: BookingSource; count: number }[];
  byCategory: { category: RoomCategory; revenue: number; nights: number }[];
  movements: { date: ISODate; arrivals: number; departures: number }[];
  /** Bookings whose stay begins in the period, for the booking report table. */
  rows: Reservation[];
}

export const reportService = {
  async dashboard() {
    const [rooms, reservations, invoices] = await Promise.all([
      repositories.rooms.list(),
      repositories.reservations.list(),
      repositories.invoices.list(),
    ]);
    const now = today();
    return {
      snapshot: snapshot(rooms, reservations, invoices),
      revenue30: revenueByDay(invoices, reservations, addDays(now, -TREND_DAYS), addDays(now, -1)),
      occupancy14: occupancyByDay(reservations, rooms.length, addDays(now, -6), addDays(now, 7)),
    };
  },

  async build(from: ISODate, to: ISODate): Promise<ReportData> {
    const [rooms, reservations, invoices, categories] = await Promise.all([
      repositories.rooms.list(),
      repositories.reservations.list(),
      repositories.invoices.list(),
      repositories.roomCategories.list(),
    ]);
    const rows = reservations.filter((r) => r.checkIn >= from && r.checkIn <= to);
    const live = rows.filter((r) => !['cancelled', 'no_show'].includes(r.status));
    const nights = live.reduce((s, r) => s + nightsBetween(r.checkIn, r.checkOut), 0);

    const sourceCounts = new Map<BookingSource, number>();
    live.forEach((r) => sourceCounts.set(r.source, (sourceCounts.get(r.source) ?? 0) + 1));

    const categoryTotals = new Map<ID, { revenue: number; nights: number }>();
    for (const r of reservations) {
      if (!['checked_in', 'checked_out'].includes(r.status)) continue;
      const stay = nightsBetween(r.checkIn, r.checkOut);
      for (let n = 0; n < stay; n++) {
        const date = addDays(r.checkIn, n);
        if (date < from || date > to) continue;
        const t = categoryTotals.get(r.categoryId) ?? { revenue: 0, nights: 0 };
        t.revenue += r.ratePerNight;
        t.nights += 1;
        categoryTotals.set(r.categoryId, t);
      }
    }

    const movements = rangeDays(from, to).map((date) => ({
      date,
      arrivals: reservations.filter((r) => r.checkIn === date && ['checked_in', 'checked_out'].includes(r.status)).length,
      departures: reservations.filter((r) => r.checkOut === date && r.status === 'checked_out').length,
    }));

    return {
      revenue: revenueByDay(invoices, reservations, from, to),
      occupancy: occupancyByDay(reservations, rooms.length, from, to),
      bookings: {
        total: rows.length,
        cancelled: rows.filter((r) => r.status === 'cancelled').length,
        noShow: rows.filter((r) => r.status === 'no_show').length,
        nights,
        averageStay: live.length ? nights / live.length : 0,
      },
      bySource: [...sourceCounts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      byCategory: categories
        .map((category) => ({ category, ...(categoryTotals.get(category.id) ?? { revenue: 0, nights: 0 }) }))
        .sort((a, b) => b.revenue - a.revenue),
      movements,
      rows: [...rows].sort((a, b) => b.checkIn.localeCompare(a.checkIn)),
    };
  },
};

/** Client-side CSV download. Works offline and needs no server. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
