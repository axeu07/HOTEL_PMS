import type { Tone } from '@/components/ui';
import type {
  BookingSource,
  CleaningStatus,
  InvoiceStatus,
  MaintenanceStatus,
  OrderStatus,
  PaymentMethod,
  Priority,
  ReservationStatus,
  RoomStatus,
  TaskStatus,
  TaskType,
} from '@/types/domain';

type Meta = { label: string; tone: Tone };

export const RESERVATION_STATUS: Record<ReservationStatus, Meta> = {
  pending: { label: 'Pending', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  checked_in: { label: 'In house', tone: 'good' },
  checked_out: { label: 'Checked out', tone: 'quiet' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
  no_show: { label: 'No-show', tone: 'bad' },
};

export const ROOM_STATUS: Record<RoomStatus, Meta> = {
  vacant: { label: 'Vacant', tone: 'quiet' },
  occupied: { label: 'Occupied', tone: 'good' },
  maintenance: { label: 'Maintenance', tone: 'bad' },
};

export const CLEANING_STATUS: Record<CleaningStatus, Meta> = {
  clean: { label: 'Clean', tone: 'good' },
  dirty: { label: 'Needs cleaning', tone: 'warn' },
  in_progress: { label: 'Being cleaned', tone: 'info' },
};

export const INVOICE_STATUS: Record<InvoiceStatus, Meta> = {
  unpaid: { label: 'Unpaid', tone: 'warn' },
  partial: { label: 'Part paid', tone: 'info' },
  paid: { label: 'Paid', tone: 'good' },
  void: { label: 'Void', tone: 'quiet' },
};

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  pending: { label: 'To do', tone: 'warn' },
  in_progress: { label: 'In progress', tone: 'info' },
  done: { label: 'Done', tone: 'good' },
};

export const TASK_TYPE: Record<TaskType, string> = {
  checkout_clean: 'Check-out clean',
  stayover: 'Stayover service',
  deep_clean: 'Deep clean',
  turndown: 'Evening turndown',
};

export const MAINTENANCE_STATUS: Record<MaintenanceStatus, Meta> = {
  open: { label: 'Open', tone: 'warn' },
  in_progress: { label: 'In progress', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'good' },
};

export const PRIORITY: Record<Priority, Meta> = {
  low: { label: 'Low', tone: 'quiet' },
  normal: { label: 'Normal', tone: 'info' },
  high: { label: 'High', tone: 'bad' },
};

export const ORDER_STATUS: Record<OrderStatus, Meta> = {
  new: { label: 'New', tone: 'warn' },
  preparing: { label: 'Preparing', tone: 'info' },
  ready: { label: 'Ready', tone: 'brass' },
  delivered: { label: 'Delivered', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
};

export const SOURCE_LABEL: Record<BookingSource, string> = {
  direct: 'Direct',
  website: 'Website',
  phone: 'Phone',
  walk_in: 'Walk-in',
  agent: 'Travel agent',
  corporate: 'Corporate',
  lead_link: 'Lead booking link',
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
};
