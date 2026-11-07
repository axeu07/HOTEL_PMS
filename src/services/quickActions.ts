import { attendanceState, shiftStart } from '@/domain/attendance';
import { addDays, toISODate } from '@/lib/dates';
import { fmtDayMonth, fmtTime, money } from '@/lib/format';
import type {
  AttendanceRecord,
  Department,
  DutyAssignment,
  Guest,
  Hotel,
  HousekeepingTask,
  ID,
  MaintenanceRequest,
  Permission,
  Priority,
  Reservation,
  Room,
  Shift,
  Staff,
} from '@/types/domain';
import { billingService, type InvoiceView } from './billing';
import { hotelService } from './core';
import { guestName, guestService } from './guests';
import { housekeepingService, maintenanceService, staffService } from './operations';
import { reservationService } from './reservations';
import { roomService } from './rooms';

/*
 * Quick Actions are derived, never stored: each one is a view of a record that still needs someone,
 * so finishing the work in its own module is what clears it. A record raises at most one action per
 * job to be done (see the notes on each builder), and items only exist where a real record backs them.
 */

export type ActionCategory = 'housekeeping' | 'staff' | 'front-desk' | 'maintenance' | 'finance' | 'guest-experience';

export type ActionKind =
  | 'dirty-room' | 'cleaning-pending' | 'cleaning-overdue'
  | 'absent' | 'late' | 'shift-gap'
  | 'overdue-checkout' | 'unchecked-room' | 'pending-arrival' | 'unassigned-room' | 'pending-confirmation'
  | 'unresolved-request' | 'out-of-service' | 'repair-in-progress'
  | 'outstanding-payment' | 'unpaid-bill'
  | 'special-arrival';

export const ACTION_CATEGORIES: { id: ActionCategory; label: string; permission: Permission }[] = [
  { id: 'housekeeping', label: 'Housekeeping', permission: 'housekeeping.view' },
  { id: 'staff', label: 'Staff', permission: 'staff.view' },
  { id: 'front-desk', label: 'Front Desk', permission: 'frontdesk.use' },
  { id: 'maintenance', label: 'Maintenance', permission: 'housekeeping.view' },
  { id: 'finance', label: 'Finance', permission: 'billing.use' },
  { id: 'guest-experience', label: 'Guest Experience', permission: 'reservations.view' },
];

/** In display order within each category. */
export const ACTION_KINDS: { id: ActionKind; category: ActionCategory; label: string; hint: string }[] = [
  { id: 'cleaning-overdue', category: 'housekeeping', label: 'Cleaning overdue', hint: 'Past their scheduled time and not started' },
  { id: 'dirty-room', category: 'housekeeping', label: 'Dirty rooms', hint: 'Vacant, with no cleaning scheduled' },
  { id: 'cleaning-pending', category: 'housekeeping', label: 'Cleaning pending', hint: 'Scheduled for today' },
  { id: 'absent', category: 'staff', label: 'Absent employees', hint: "Not checked in for today's shift" },
  { id: 'late', category: 'staff', label: 'Late arrivals', hint: 'Arrived after their shift began' },
  { id: 'shift-gap', category: 'staff', label: 'Missing shift assignments', hint: 'Normally covered on the roster, nobody assigned today' },
  { id: 'overdue-checkout', category: 'front-desk', label: 'Overdue check-outs', hint: 'Due out today, past check-out time' },
  { id: 'unchecked-room', category: 'front-desk', label: 'Unchecked-out rooms', hint: 'Stay ended on an earlier day, room still held' },
  { id: 'unassigned-room', category: 'front-desk', label: 'Unassigned rooms', hint: 'Arriving within 7 days with no room' },
  { id: 'pending-confirmation', category: 'front-desk', label: 'Pending reservation confirmations', hint: 'Booking requests still to confirm' },
  { id: 'pending-arrival', category: 'front-desk', label: "Today's pending arrivals", hint: 'Still to check in. VIP and special arrivals are listed separately' },
  { id: 'unresolved-request', category: 'maintenance', label: 'Unresolved maintenance requests', hint: 'Reported, work not started' },
  { id: 'out-of-service', category: 'maintenance', label: 'Out-of-service rooms', hint: 'Cannot be sold until repaired' },
  { id: 'repair-in-progress', category: 'maintenance', label: 'Pending repairs', hint: 'Work under way' },
  { id: 'outstanding-payment', category: 'finance', label: 'Outstanding guest payments', hint: 'In-house guests with a balance' },
  { id: 'unpaid-bill', category: 'finance', label: 'Unpaid bills', hint: 'Guest has left with a balance' },
  { id: 'special-arrival', category: 'front-desk', label: 'VIP & special arrivals', hint: 'Arriving today with a VIP flag or a noted request' },
];

/** Asked for in the brief, but nothing in the system records them, so no alerts can be raised honestly. */
export const UNTRACKED_ACTIONS: { category: ActionCategory; label: string }[] = [
  { category: 'housekeeping', label: 'rooms awaiting inspection' },
  { category: 'finance', label: 'pending refunds' },
  { category: 'guest-experience', label: 'guest complaints' },
];

export interface QuickAction {
  /** `kind:record`, so one record can never raise the same alert twice. */
  id: string;
  category: ActionCategory;
  kind: ActionKind;
  title: string;
  details: string[];
  status: { label: string; tone: 'good' | 'warn' | 'bad' | 'info' | 'quiet' | 'brass' };
  priority: Priority;
  /** When this became due or happened, for ordering. */
  at: string | null;
  when: string;
  /** The record in its own module. */
  to: string;
  vip: boolean;
  resolved: boolean;
  /** Counts towards the Rooms to Clean card, which spans several kinds. */
  roomsToClean: boolean;
  /** Attendance is the one thing with no other screen to finish it from first. */
  command?: { type: 'mark-arrived' | 'review-late'; id: ID };
}

export interface QuickActionSources {
  hotel: Hotel;
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  tasks: HousekeepingTask[];
  maintenance: MaintenanceRequest[];
  invoices: InvoiceView[];
  staff: Staff[];
  duties: DutyAssignment[];
  attendance: AttendanceRecord[];
}

type PrioritySources = Pick<QuickActionSources, 'hotel' | 'rooms' | 'reservations' | 'staff' | 'duties' | 'attendance'>;

/* ---------- Shared rules ---------- */

const BALANCE_DUE = 0.009;
const ARRIVAL_WINDOW_DAYS = 7;

const at = (date: string, time: string) => new Date(`${date}T${time}:00`);
const isToday = (stamp: string | null, today: string) => !!stamp && toISODate(new Date(stamp)) === today;

function since(from: Date, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return mins % 60 ? `${hours} hr ${mins % 60} min` : `${hours} hr`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** Same rule as the Available KPI's "awaiting cleaning" note, so the two figures always agree. */
export const selectRoomsToClean = (rooms: Room[]) => rooms.filter((r) => r.status === 'vacant' && r.cleaning !== 'clean');

/** Due out today and past the hotel's check-out time. Earlier days are unchecked-out rooms instead. */
export function selectOverdueCheckouts(reservations: Reservation[], hotel: Hotel, now: Date) {
  const today = toISODate(now);
  if (now <= at(today, hotel.checkOutTime)) return [];
  return reservations.filter((r) => r.status === 'checked_in' && r.checkOut === today);
}

/** Rooms still held although the stay should have ended on an earlier day, or with nobody in house at all. */
export function selectUncheckedRooms(rooms: Room[], reservations: Reservation[], now: Date) {
  const today = toISODate(now);
  const inHouse = new Map(reservations.filter((r) => r.status === 'checked_in' && r.roomId).map((r) => [r.roomId!, r]));
  return rooms
    .filter((room) => room.status === 'occupied' && (!inHouse.has(room.id) || inHouse.get(room.id)!.checkOut < today))
    .map((room) => ({ room, stay: inHouse.get(room.id) ?? null }));
}

/** Today's rostered shifts for active staff, with how each stands right now. */
export function selectShiftAttendance(staff: Staff[], duties: DutyAssignment[], attendance: AttendanceRecord[], now: Date) {
  const today = toISODate(now);
  const people = new Map(staff.filter((s) => s.active).map((s) => [s.id, s]));
  const records = new Map(attendance.map((a) => [a.dutyId, a]));
  return duties
    .filter((d) => d.date === today && people.has(d.staffId))
    .map((duty) => {
      const record = records.get(duty.id);
      return { duty, person: people.get(duty.staffId)!, record, state: attendanceState(duty, record, now) };
    });
}

/* ---------- Dashboard cards ---------- */

export type PriorityKey = 'rooms-to-clean' | 'absent' | 'overdue-checkout' | 'unchecked-room';

export interface PriorityCard {
  key: PriorityKey;
  title: string;
  count: number;
  description: string;
  urgency: 'urgent' | 'attention' | 'clear';
  to: string;
}

const nameList = (names: string[]) => (names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]);

/** Reads less than the full page does, and shares its selectors, so card and detail counts cannot drift. */
export function priorityActions({ hotel, rooms, reservations, staff, duties, attendance }: PrioritySources, now: Date): PriorityCard[] {
  const today = toISODate(now);
  const toClean = selectRoomsToClean(rooms);
  const arrivingRooms = new Set(reservations.filter((r) => r.checkIn === today && ['confirmed', 'pending'].includes(r.status)).map((r) => r.roomId));
  const neededToday = toClean.filter((r) => arrivingRooms.has(r.id)).length;
  const beingCleaned = toClean.filter((r) => r.cleaning === 'in_progress').length;

  const shifts = selectShiftAttendance(staff, duties, attendance, now);
  const absent = shifts.filter((s) => s.state === 'absent');
  const started = shifts.filter((s) => s.state !== 'upcoming').length;

  const overdue = selectOverdueCheckouts(reservations, hotel, now);
  const dueLater = overdue.length ? 0 : reservations.filter((r) => r.status === 'checked_in' && r.checkOut === today).length;
  const unchecked = selectUncheckedRooms(rooms, reservations, now);
  const oldest = unchecked.map((u) => u.stay?.checkOut).filter(Boolean).sort()[0];

  return [
    {
      key: 'rooms-to-clean',
      title: 'Rooms to Clean',
      count: toClean.length,
      description: !toClean.length
        ? 'Every vacant room is ready to sell'
        : neededToday
          ? `${neededToday} needed for a guest arriving today`
          : beingCleaned
            ? `Vacant, ${beingCleaned} being cleaned now`
            : 'Vacant, awaiting housekeeping',
      urgency: !toClean.length ? 'clear' : neededToday ? 'urgent' : 'attention',
      to: '/app/quick-actions?category=housekeeping&focus=rooms-to-clean',
    },
    {
      key: 'absent',
      title: 'Staff Absent',
      count: absent.length,
      description: absent.length
        ? `Not checked in: ${nameList(absent.map((a) => a.person.name))}`
        : started
          ? `All ${started} on shift have checked in`
          : 'No shift has started yet today',
      urgency: absent.length ? 'urgent' : 'clear',
      to: '/app/quick-actions?category=staff&focus=absent',
    },
    {
      key: 'overdue-checkout',
      title: 'Overdue Check-outs',
      count: overdue.length,
      description: overdue.length
        ? `Past the ${hotel.checkOutTime} check-out time`
        : dueLater
          ? `${dueLater} more due out by ${hotel.checkOutTime}`
          : 'No guests past check-out time',
      urgency: overdue.length ? 'urgent' : 'clear',
      to: '/app/quick-actions?category=front-desk&focus=overdue-checkout',
    },
    {
      key: 'unchecked-room',
      title: 'Unchecked-out Rooms',
      count: unchecked.length,
      description: !unchecked.length
        ? 'No rooms held past their stay'
        : oldest
          ? `Should have been checked out on ${fmtDayMonth(oldest)}`
          : 'Marked occupied with nobody in house',
      urgency: unchecked.length ? 'urgent' : 'clear',
      to: '/app/quick-actions?category=front-desk&focus=unchecked-room',
    },
  ];
}

/* ---------- Detail builders ---------- */

const baseAction = { vip: false, resolved: false, roomsToClean: false };

/** One action per room: the most pressing open task, or the room itself if nothing is scheduled. */
function housekeepingActions(s: QuickActionSources, now: Date): QuickAction[] {
  const today = toISODate(now);
  const roomById = new Map(s.rooms.map((r) => [r.id, r]));
  const staffName = new Map(s.staff.map((p) => [p.id, p.name]));
  const arrivingRooms = new Set(s.reservations.filter((r) => r.checkIn === today && ['confirmed', 'pending'].includes(r.status)).map((r) => r.roomId));
  const isOverdue = (t: HousekeepingTask) => t.date < today || (t.status === 'pending' && !!t.time && now > at(t.date, t.time));
  const urgency = (t: HousekeepingTask) => (isOverdue(t) ? 0 : 2) + (t.priority === 'high' ? 0 : 1);

  const taskByRoom = new Map<ID, HousekeepingTask>();
  for (const task of s.tasks) {
    const room = roomById.get(task.roomId);
    if (task.status === 'done' || task.date > today || !room) continue;
    // A departure clean cannot start until the guest leaves (the overdue check-out is the alert),
    // and is moot once the room has been marked clean by hand.
    if (task.type === 'checkout_clean' && (room.status === 'occupied' || room.cleaning === 'clean')) continue;
    const held = taskByRoom.get(room.id);
    if (!held || urgency(task) < urgency(held)) taskByRoom.set(room.id, task);
  }

  const out: QuickAction[] = [];
  for (const [roomId, task] of taskByRoom) {
    const room = roomById.get(roomId)!;
    const overdue = isOverdue(task);
    const due = task.time ? at(task.date, task.time) : null;
    const assignee = task.assigneeId ? staffName.get(task.assigneeId) : null;
    out.push({
      ...baseAction,
      id: `task:${task.id}`,
      category: 'housekeeping',
      kind: overdue ? 'cleaning-overdue' : 'cleaning-pending',
      title: `Room ${room.number}`,
      details: [assignee ?? 'Unassigned', task.notes],
      status: task.status === 'in_progress' ? { label: 'In progress', tone: 'info' } : { label: overdue ? 'Not started' : 'To do', tone: 'warn' },
      priority: task.date < today || task.priority === 'high' || arrivingRooms.has(room.id) ? 'high' : task.priority,
      at: due?.toISOString() ?? null,
      when: !due ? 'As soon as possible' : overdue ? `Due ${task.date < today ? fmtDayMonth(task.date) : task.time}, ${since(due, now)} ago` : `Due ${task.time}`,
      to: `/app/housekeeping?focus=${task.id}`,
      roomsToClean: room.status === 'vacant' && room.cleaning !== 'clean',
    });
  }
  for (const room of selectRoomsToClean(s.rooms)) {
    if (taskByRoom.has(room.id)) continue;
    out.push({
      ...baseAction,
      id: `room:${room.id}`,
      category: 'housekeeping',
      kind: 'dirty-room',
      title: `Room ${room.number}`,
      details: [arrivingRooms.has(room.id) ? 'Guest arriving today' : 'No cleaning scheduled'],
      status: room.cleaning === 'in_progress' ? { label: 'Being cleaned', tone: 'info' } : { label: 'Needs cleaning', tone: 'warn' },
      priority: arrivingRooms.has(room.id) ? 'high' : 'normal',
      at: null,
      when: 'Now',
      to: `/app/rooms?open=${room.id}`,
      roomsToClean: true,
    });
  }
  for (const task of s.tasks) {
    const room = roomById.get(task.roomId);
    if (task.status !== 'done' || !room || !isToday(task.completedAt, today)) continue;
    out.push({
      ...baseAction,
      id: `task:${task.id}`,
      category: 'housekeeping',
      kind: 'cleaning-pending',
      title: `Room ${room.number}`,
      details: [task.assigneeId ? staffName.get(task.assigneeId) ?? '' : ''],
      status: { label: 'Cleaned', tone: 'good' },
      priority: task.priority,
      at: task.completedAt,
      when: `Finished ${fmtTime(task.completedAt!)}`,
      to: `/app/housekeeping?focus=${task.id}`,
      resolved: true,
    });
  }
  return out;
}

function staffActions(s: QuickActionSources, now: Date): QuickAction[] {
  const today = toISODate(now);
  const out: QuickAction[] = [];
  for (const { duty, person, record, state } of selectShiftAttendance(s.staff, s.duties, s.attendance, now)) {
    const started = shiftStart(duty);
    const details = [person.jobTitle, `${duty.shift} shift`, duty.area];
    const to = `/app/staff?tab=roster&focus=${duty.id}`;
    if (state === 'absent') {
      out.push({
        ...baseAction,
        id: `absent:${duty.id}`,
        category: 'staff',
        kind: 'absent',
        title: person.name,
        details,
        status: { label: 'Not checked in', tone: 'bad' },
        priority: 'high',
        at: started.toISOString(),
        when: `Shift began ${fmtTime(started.toISOString())}, ${since(started, now)} ago`,
        to,
        command: { type: 'mark-arrived', id: duty.id },
      });
    } else if (state === 'late' && record) {
      const arrived = new Date(record.clockedInAt);
      const reviewed = isToday(record.reviewedAt, today);
      out.push({
        ...baseAction,
        id: `late:${duty.id}`,
        category: 'staff',
        kind: 'late',
        title: person.name,
        details,
        status: reviewed ? { label: 'Noted', tone: 'good' } : { label: 'Arrived late', tone: 'warn' },
        priority: 'normal',
        at: record.clockedInAt,
        when: `Arrived ${fmtTime(record.clockedInAt)}, ${since(started, arrived)} after the start`,
        to,
        resolved: reviewed,
        command: reviewed ? undefined : { type: 'review-late', id: record.id },
      });
    }
  }

  // The roster has no stated minimum cover, so a gap means: this team works this shift on other days but not today.
  const teamOf = new Map(s.staff.filter((p) => p.active).map((p) => [p.id, p.department]));
  const slot = (d: DutyAssignment) => `${teamOf.get(d.staffId)}|${d.shift}`;
  const coveredToday = new Set(s.duties.filter((d) => d.date === today).map(slot));
  const gaps = new Set(s.duties.filter((d) => d.date !== today && teamOf.has(d.staffId) && !coveredToday.has(slot(d))).map(slot));
  for (const gap of gaps) {
    const [department, shift] = gap.split('|') as [Department, Shift];
    out.push({
      ...baseAction,
      id: `gap:${gap}`,
      category: 'staff',
      kind: 'shift-gap',
      title: `${shift} shift, ${department}`,
      details: [`Nobody from ${department} is assigned`],
      status: { label: 'No cover', tone: 'warn' },
      priority: 'normal',
      at: null,
      when: 'Today',
      to: '/app/staff?tab=roster',
    });
  }
  return out;
}

/** Each live booking raises one front-of-house action: confirm it, then room it, then welcome it. */
function bookingActions(s: QuickActionSources, now: Date): QuickAction[] {
  const today = toISODate(now);
  const roomById = new Map(s.rooms.map((r) => [r.id, r]));
  const guestById = new Map(s.guests.map((g) => [g.id, g]));
  const out: QuickAction[] = [];

  const stayFields = (r: Reservation) => {
    const guest = guestById.get(r.guestId);
    return { title: guestName(guest), vip: !!guest?.vip, room: r.roomId ? roomById.get(r.roomId)?.number : undefined, to: `/app/reservations?open=${r.id}` };
  };
  const specialNote = (r: Reservation) => r.notes || guestById.get(r.guestId)?.preferences.notes || '';

  for (const r of selectOverdueCheckouts(s.reservations, s.hotel, now)) {
    const { room, ...fields } = stayFields(r);
    const deadline = at(today, s.hotel.checkOutTime);
    out.push({
      ...baseAction,
      ...fields,
      id: `overdue:${r.id}`,
      category: 'front-desk',
      kind: 'overdue-checkout',
      details: [room ? `Room ${room}` : '', r.code],
      status: { label: 'Not checked out', tone: 'bad' },
      priority: 'high',
      at: deadline.toISOString(),
      when: `Due ${s.hotel.checkOutTime}, ${since(deadline, now)} ago`,
    });
  }
  for (const { room, stay } of selectUncheckedRooms(s.rooms, s.reservations, now)) {
    const guest = stay ? guestById.get(stay.guestId) : undefined;
    const deadline = stay ? at(stay.checkOut, s.hotel.checkOutTime) : null;
    out.push({
      ...baseAction,
      id: `unchecked:${room.id}`,
      category: 'front-desk',
      kind: 'unchecked-room',
      title: `Room ${room.number}`,
      details: stay ? [guestName(guest), stay.code] : ['Marked occupied with no guest in house'],
      status: { label: 'Still held', tone: 'bad' },
      priority: 'high',
      at: deadline?.toISOString() ?? null,
      when: deadline ? `Was due ${fmtDayMonth(stay!.checkOut)}, ${since(deadline, now)} ago` : 'Now',
      to: stay ? `/app/reservations?open=${stay.id}` : `/app/rooms?open=${room.id}`,
      vip: !!guest?.vip,
    });
  }

  for (const r of s.reservations) {
    const { room, ...fields } = stayFields(r);
    const arrivesToday = r.checkIn === today;
    const arrival = at(r.checkIn, s.hotel.checkInTime).toISOString();
    if (r.status === 'pending') {
      out.push({
        ...baseAction,
        ...fields,
        id: `confirm:${r.id}`,
        category: 'front-desk',
        kind: 'pending-confirmation',
        details: [r.code, room ? `Room ${room}` : 'No room yet'],
        status: { label: 'Pending', tone: 'warn' },
        priority: r.checkIn <= addDays(today, 1) ? 'high' : 'normal',
        at: r.createdAt,
        when: `Arriving ${fmtDayMonth(r.checkIn)}`,
      });
    } else if (r.status === 'confirmed' && !r.roomId && r.checkIn >= today && r.checkIn <= addDays(today, ARRIVAL_WINDOW_DAYS)) {
      out.push({
        ...baseAction,
        ...fields,
        id: `unassigned:${r.id}`,
        category: 'front-desk',
        kind: 'unassigned-room',
        details: [r.code],
        status: { label: 'No room yet', tone: 'warn' },
        priority: arrivesToday ? 'high' : 'normal',
        at: arrival,
        when: `Arriving ${fmtDayMonth(r.checkIn)}`,
      });
    } else if (r.status === 'confirmed' && arrivesToday) {
      const note = specialNote(r);
      const special = fields.vip || !!note;
      const roomState = r.roomId ? roomById.get(r.roomId) : undefined;
      const ready = roomState?.status === 'vacant' && roomState.cleaning === 'clean';
      out.push({
        ...baseAction,
        ...fields,
        id: `arrival:${r.id}`,
        category: 'front-desk',
        kind: special ? 'special-arrival' : 'pending-arrival',
        details: [room ? `Room ${room}` : '', r.code, note],
        status: ready ? { label: 'Room ready', tone: 'good' } : { label: 'Room not ready', tone: 'warn' },
        priority: fields.vip || !ready ? 'high' : 'normal',
        at: arrival,
        when: `Expected from ${s.hotel.checkInTime}`,
      });
    } else if (r.status === 'checked_in' && arrivesToday && r.source !== 'walk_in' && isToday(r.checkedInAt, today)) {
      const special = fields.vip || !!specialNote(r);
      out.push({
        ...baseAction,
        ...fields,
        id: `arrival:${r.id}`,
        category: 'front-desk',
        kind: special ? 'special-arrival' : 'pending-arrival',
        details: [room ? `Room ${room}` : '', r.code],
        status: { label: 'Checked in', tone: 'good' },
        priority: 'normal',
        at: r.checkedInAt,
        when: `Checked in ${fmtTime(r.checkedInAt!)}`,
        resolved: true,
      });
    } else if (r.status === 'checked_out' && isToday(r.checkedOutAt, today) && new Date(r.checkedOutAt!) > at(today, s.hotel.checkOutTime)) {
      out.push({
        ...baseAction,
        ...fields,
        id: `overdue:${r.id}`,
        category: 'front-desk',
        kind: 'overdue-checkout',
        details: [room ? `Room ${room}` : '', r.code],
        status: { label: 'Checked out', tone: 'good' },
        priority: 'high',
        at: r.checkedOutAt,
        when: `Checked out ${fmtTime(r.checkedOutAt!)}`,
        resolved: true,
      });
    }
  }
  return out;
}

/** A room that is out of service carries its request, rather than showing up in two lists. */
function maintenanceActions(s: QuickActionSources, now: Date): QuickAction[] {
  const today = toISODate(now);
  const roomById = new Map(s.rooms.map((r) => [r.id, r]));
  const open = s.maintenance.filter((m) => m.status !== 'resolved');
  const carried = new Set<ID>();
  const out: QuickAction[] = [];

  for (const room of s.rooms.filter((r) => r.status === 'maintenance')) {
    const request = open.find((m) => m.roomId === room.id && m.roomOffline);
    if (request) carried.add(request.id);
    out.push({
      ...baseAction,
      id: `offline:${room.id}`,
      category: 'maintenance',
      kind: 'out-of-service',
      title: `Room ${room.number}`,
      details: request ? [request.title, `Reported by ${request.reportedBy}`] : ['No maintenance request logged'],
      status: { label: 'Out of service', tone: 'bad' },
      priority: request?.priority ?? 'normal',
      at: request?.createdAt ?? null,
      when: request ? `Reported ${fmtDayMonth(request.createdAt.slice(0, 10))}, ${fmtTime(request.createdAt)}` : 'Now',
      to: request ? `/app/housekeeping?tab=maintenance&focus=${request.id}` : `/app/rooms?open=${room.id}`,
    });
  }
  for (const m of s.maintenance) {
    if (carried.has(m.id)) continue;
    const room = `Room ${roomById.get(m.roomId)?.number ?? '–'}`;
    const to = `/app/housekeeping?tab=maintenance&focus=${m.id}`;
    if (m.status !== 'resolved') {
      out.push({
        ...baseAction,
        id: `request:${m.id}`,
        category: 'maintenance',
        kind: m.status === 'open' ? 'unresolved-request' : 'repair-in-progress',
        title: room,
        details: [m.title, `Reported by ${m.reportedBy}`],
        status: m.status === 'open' ? { label: 'Open', tone: 'warn' } : { label: 'In progress', tone: 'info' },
        priority: m.priority,
        at: m.createdAt,
        when: `Reported ${fmtDayMonth(m.createdAt.slice(0, 10))}, ${fmtTime(m.createdAt)}`,
        to,
      });
    } else if (isToday(m.resolvedAt, today)) {
      out.push({
        ...baseAction,
        id: `request:${m.id}`,
        category: 'maintenance',
        kind: 'unresolved-request',
        title: room,
        details: [m.title],
        status: { label: 'Resolved', tone: 'good' },
        priority: m.priority,
        at: m.resolvedAt,
        when: `Resolved ${fmtTime(m.resolvedAt!)}`,
        to,
        resolved: true,
      });
    }
  }
  return out;
}

/** Same rule as Billing's outstanding figure: upcoming stays carry a folio but owe nothing yet. */
function financeActions(s: QuickActionSources, now: Date): QuickAction[] {
  const today = toISODate(now);
  const stayById = new Map(s.reservations.map((r) => [r.id, r]));
  const roomById = new Map(s.rooms.map((r) => [r.id, r]));
  const guestById = new Map(s.guests.map((g) => [g.id, g]));
  const out: QuickAction[] = [];

  for (const { invoice, totals, payments } of s.invoices) {
    const stay = stayById.get(invoice.reservationId);
    if (!stay || invoice.status === 'void' || !['checked_in', 'checked_out'].includes(stay.status)) continue;
    const guest = guestById.get(invoice.guestId);
    const roomNumber = stay.roomId ? roomById.get(stay.roomId)?.number : undefined;
    const base = {
      ...baseAction,
      id: `invoice:${invoice.id}`,
      category: 'finance' as const,
      title: guestName(guest),
      vip: !!guest?.vip,
      to: `/app/billing?invoice=${invoice.id}`,
    };
    if (totals.balance > BALANCE_DUE) {
      const leftAlready = stay.status === 'checked_out';
      const label = invoice.status === 'partial' ? 'Part paid' : 'Unpaid';
      out.push({
        ...base,
        kind: leftAlready ? 'unpaid-bill' : 'outstanding-payment',
        details: [`${money(totals.balance)} due`, invoice.number, stay.code, roomNumber ? `Room ${roomNumber}` : ''],
        status: { label, tone: invoice.status === 'partial' ? 'info' : 'warn' },
        priority: leftAlready || stay.checkOut <= today ? 'high' : 'normal',
        at: `${invoice.issuedOn}T00:00:00`,
        when: leftAlready ? `Left ${fmtDayMonth(stay.checkOut)}` : `Leaving ${fmtDayMonth(stay.checkOut)}`,
      });
    } else {
      const settled = payments.find((p) => p.receivedOn === today);
      if (!settled) continue;
      out.push({
        ...base,
        kind: 'outstanding-payment',
        details: [`${money(totals.total)} settled`, invoice.number, stay.code],
        status: { label: 'Paid', tone: 'good' },
        priority: 'normal',
        at: `${today}T00:00:00`,
        when: 'Settled today',
        resolved: true,
      });
    }
  }
  return out;
}

/* ---------- Everything together ---------- */

const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

export function deriveQuickActions(s: QuickActionSources, now: Date): QuickAction[] {
  const unique = new Map<string, QuickAction>();
  const all = [housekeepingActions, staffActions, bookingActions, maintenanceActions, financeActions].flatMap((build) => build(s, now));
  for (const action of all) if (!unique.has(action.id)) unique.set(action.id, { ...action, details: action.details.filter(Boolean) });
  return [...unique.values()].sort(
    (a, b) =>
      Number(a.resolved) - Number(b.resolved) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.resolved ? (b.at ?? '').localeCompare(a.at ?? '') : (a.at ?? '9').localeCompare(b.at ?? '9')) ||
      a.title.localeCompare(b.title, undefined, { numeric: true }),
  );
}

/** A dashboard card's filter: one kind, or the rooms behind Rooms to Clean. */
export const matchesFocus = (action: QuickAction, focus: string) => action.kind === focus || (focus === 'rooms-to-clean' && action.roomsToClean);

export const quickActionService = {
  /** What the dashboard cards need beyond the rooms and bookings it has already loaded. */
  async rosterSources() {
    const [hotel, staff, duties, attendance] = await Promise.all([hotelService.get(), staffService.list(), staffService.duties(), staffService.attendance()]);
    return { hotel, staff, duties, attendance };
  },

  async load(): Promise<QuickActionSources> {
    const [hotel, rooms, guests, reservations, tasks, maintenance, invoices, staff, duties, attendance] = await Promise.all([
      hotelService.get(),
      roomService.list(),
      guestService.list(),
      reservationService.list(),
      housekeepingService.list(),
      maintenanceService.list(),
      billingService.listViews(),
      staffService.list(),
      staffService.duties(),
      staffService.attendance(),
    ]);
    return { hotel, rooms, guests, reservations, tasks, maintenance, invoices, staff, duties, attendance };
  },
};
