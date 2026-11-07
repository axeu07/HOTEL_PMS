import type { AttendanceRecord, DutyAssignment, Shift } from '@/types/domain';

export const SHIFT_WINDOWS: Record<Shift, { start: string; end: string }> = {
  Morning: { start: '06:00', end: '14:00' },
  Evening: { start: '14:00', end: '22:00' },
  Night: { start: '22:00', end: '06:00' },
};

/** How long after a shift starts someone can arrive and still count as on time. */
export const LATE_GRACE_MINUTES = 15;

export type AttendanceState = 'upcoming' | 'present' | 'late' | 'absent';

export function shiftStart(duty: Pick<DutyAssignment, 'date' | 'shift'>): Date {
  return new Date(`${duty.date}T${SHIFT_WINDOWS[duty.shift].start}:00`);
}

/** A clock-in still in the future has not happened yet, so it does not count as arrived. */
export function attendanceState(duty: Pick<DutyAssignment, 'date' | 'shift'>, record: AttendanceRecord | undefined, now: Date): AttendanceState {
  const graceEnds = shiftStart(duty).getTime() + LATE_GRACE_MINUTES * 60_000;
  const arrivedAt = record ? new Date(record.clockedInAt).getTime() : null;
  if (arrivedAt !== null && arrivedAt <= now.getTime()) return arrivedAt > graceEnds ? 'late' : 'present';
  return now.getTime() > graceEnds ? 'absent' : 'upcoming';
}
