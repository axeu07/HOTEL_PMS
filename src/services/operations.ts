import { DomainError } from '@/lib/validation';
import { repositories } from '@/repositories';
import type {
  DutyAssignment,
  HousekeepingTask,
  ID,
  MaintenanceRequest,
  MenuItem,
  OrderItem,
  OrderStatus,
  OrderType,
  Priority,
  RestaurantOrder,
  Staff,
} from '@/types/domain';
import { billingService } from './billing';
import { activityService, newId } from './core';

/* ---------- Housekeeping ---------- */

export const housekeepingService = {
  list: () => repositories.housekeepingTasks.list(),

  async create(input: Omit<HousekeepingTask, 'id' | 'status' | 'completedAt'>) {
    return repositories.housekeepingTasks.create({ ...input, id: newId('task'), status: 'pending', completedAt: null });
  },
  update: (id: ID, patch: Partial<HousekeepingTask>) => repositories.housekeepingTasks.update(id, patch),
  remove: (id: ID) => repositories.housekeepingTasks.remove(id),

  assign: (id: ID, assigneeId: ID | null) => repositories.housekeepingTasks.update(id, { assigneeId }),

  async start(id: ID) {
    const task = await repositories.housekeepingTasks.update(id, { status: 'in_progress' });
    await repositories.rooms.update(task.roomId, { cleaning: 'in_progress' });
  },

  /** Finishing a task is what makes a room sellable again. */
  async complete(id: ID) {
    const task = await repositories.housekeepingTasks.update(id, {
      status: 'done',
      completedAt: new Date().toISOString(),
    });
    await repositories.rooms.update(task.roomId, { cleaning: 'clean' });
    const room = await repositories.rooms.get(task.roomId);
    await activityService.log(`Room ${room?.number ?? ''} is clean and ready`, 'success', '/app/rooms');
  },

  async reopen(id: ID) {
    const task = await repositories.housekeepingTasks.update(id, { status: 'pending', completedAt: null });
    await repositories.rooms.update(task.roomId, { cleaning: 'dirty' });
  },
};

/* ---------- Maintenance ---------- */

export const maintenanceService = {
  list: () => repositories.maintenanceRequests.list(),

  async create(input: {
    roomId: ID;
    title: string;
    description: string;
    priority: Priority;
    reportedBy: string;
    assigneeId: ID | null;
    takeOffline: boolean;
  }) {
    const room = await repositories.rooms.get(input.roomId);
    if (!room) throw new DomainError('Choose a room.');
    if (input.takeOffline && room.status === 'occupied') {
      throw new DomainError(`A guest is in room ${room.number}, so it cannot go out of service yet.`);
    }
    const { takeOffline, ...fields } = input;
    const request = await repositories.maintenanceRequests.create({
      ...fields,
      id: newId('mnt'),
      status: 'open',
      roomOffline: takeOffline,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });
    if (takeOffline) await repositories.rooms.update(room.id, { status: 'maintenance' });
    await activityService.log(`Maintenance logged for room ${room.number}: ${input.title}`, 'warning', '/app/housekeeping?tab=maintenance');
    return request;
  },

  update: (id: ID, patch: Partial<MaintenanceRequest>) => repositories.maintenanceRequests.update(id, patch),

  async resolve(id: ID) {
    const request = await repositories.maintenanceRequests.update(id, {
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    });
    if (request.roomOffline) {
      const others = (await repositories.maintenanceRequests.list()).filter(
        (m) => m.roomId === request.roomId && m.roomOffline && m.status !== 'resolved',
      );
      // The room comes back only once nothing else is holding it out of service,
      // and it needs a clean before it can be sold.
      if (others.length === 0) {
        await repositories.rooms.update(request.roomId, { status: 'vacant', cleaning: 'dirty' });
      }
    }
    const room = await repositories.rooms.get(request.roomId);
    await activityService.log(`Maintenance resolved in room ${room?.number ?? ''}`, 'success', '/app/housekeeping?tab=maintenance');
  },

  remove: (id: ID) => repositories.maintenanceRequests.remove(id),
};

/* ---------- Restaurant ---------- */

export const ORDER_FLOW: OrderStatus[] = ['new', 'preparing', 'ready', 'delivered'];

export const orderTotal = (order: Pick<RestaurantOrder, 'items'>): number =>
  order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

export const restaurantService = {
  menu: () => repositories.menuItems.list(),

  async saveMenuItem(input: Omit<MenuItem, 'id'> & { id?: ID }) {
    if (input.id) return repositories.menuItems.update(input.id, input);
    return repositories.menuItems.create({ ...input, id: newId('menu') });
  },
  removeMenuItem: (id: ID) => repositories.menuItems.remove(id),

  async orders(): Promise<RestaurantOrder[]> {
    const rows = await repositories.restaurantOrders.list();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createOrder(input: {
    type: OrderType;
    reservationId: ID | null;
    tableLabel: string;
    items: OrderItem[];
    notes: string;
  }) {
    if (input.items.length === 0) throw new DomainError('Add at least one item.');
    if (input.type === 'room_service' && !input.reservationId) {
      throw new DomainError('Choose the in-house guest for this room service order.');
    }
    const rows = await repositories.restaurantOrders.list();
    const max = rows.reduce((m, o) => Math.max(m, Number(o.code.split('-')[1]) || 0), 3100);
    return repositories.restaurantOrders.create({
      ...input,
      id: newId('ord'),
      code: `KOT-${max + 1}`,
      status: 'new',
      postedInvoiceId: null,
      createdAt: new Date().toISOString(),
    });
  },

  async advance(id: ID) {
    const order = await repositories.restaurantOrders.get(id);
    if (!order) throw new DomainError('Order not found.');
    const index = ORDER_FLOW.indexOf(order.status);
    if (index < 0 || index === ORDER_FLOW.length - 1) return;
    await repositories.restaurantOrders.update(id, { status: ORDER_FLOW[index + 1] });
  },

  async cancel(id: ID) {
    const order = await repositories.restaurantOrders.get(id);
    if (order?.postedInvoiceId) throw new DomainError('Remove this charge from the guest bill before cancelling.');
    await repositories.restaurantOrders.update(id, { status: 'cancelled' });
  },

  async postToBill(id: ID) {
    const order = await repositories.restaurantOrders.get(id);
    if (!order) throw new DomainError('Order not found.');
    if (order.postedInvoiceId) throw new DomainError('This order is already on the guest bill.');
    if (!order.reservationId) throw new DomainError('This order is not linked to a stay, so it cannot go on a room bill.');
    const view = await billingService.viewForReservation(order.reservationId);
    if (!view) throw new DomainError('No open bill was found for this stay.');
    await billingService.addCharge(view.invoice.id, {
      kind: 'food',
      description: `${order.type === 'room_service' ? 'Room service' : 'Saffron Room'} · ${order.code}`,
      quantity: 1,
      unitPrice: orderTotal(order),
      orderId: order.id,
    });
    await repositories.restaurantOrders.update(id, { postedInvoiceId: view.invoice.id });
    await activityService.log(`${order.code} charged to invoice ${view.invoice.number}`, 'success', `/app/billing?invoice=${view.invoice.id}`);
  },
};

/* ---------- Staff ---------- */

export const staffService = {
  async list(): Promise<Staff[]> {
    const rows = await repositories.staff.list();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
  async save(input: Omit<Staff, 'id'> & { id?: ID }): Promise<Staff> {
    if (input.id) return repositories.staff.update(input.id, input);
    return repositories.staff.create({ ...input, id: newId('staff') });
  },
  async remove(id: ID) {
    const users = await repositories.users.list();
    if (users.some((u) => u.staffId === id)) {
      throw new DomainError('This person has a demo login, so the record is kept. Mark them inactive instead.');
    }
    const [tasks, duties] = await Promise.all([repositories.housekeepingTasks.list(), repositories.duties.list()]);
    await Promise.all(
      tasks.filter((t) => t.assigneeId === id && t.status !== 'done').map((t) => repositories.housekeepingTasks.update(t.id, { assigneeId: null })),
    );
    await Promise.all(duties.filter((d) => d.staffId === id).map((d) => staffService.removeDuty(d.id)));
    await repositories.staff.remove(id);
  },

  duties: () => repositories.duties.list(),
  async saveDuty(input: Omit<DutyAssignment, 'id'> & { id?: ID }) {
    const duties = await repositories.duties.list();
    if (duties.some((d) => d.staffId === input.staffId && d.date === input.date && d.shift === input.shift && d.id !== input.id)) {
      throw new DomainError('This person is already on that shift.');
    }
    if (input.id) return repositories.duties.update(input.id, input);
    return repositories.duties.create({ ...input, id: newId('duty') });
  },
  async removeDuty(id: ID) {
    const records = await repositories.attendance.list();
    await Promise.all(records.filter((a) => a.dutyId === id).map((a) => repositories.attendance.remove(a.id)));
    await repositories.duties.remove(id);
  },

  attendance: () => repositories.attendance.list(),

  /** Records someone as arrived now. A manager doing this has already seen it, so nothing is left to review. */
  async markArrived(dutyId: ID) {
    const duty = await repositories.duties.get(dutyId);
    if (!duty) throw new DomainError('This shift is no longer on the roster.');
    const at = new Date().toISOString();
    const existing = (await repositories.attendance.list()).find((a) => a.dutyId === dutyId);
    if (existing) await repositories.attendance.update(existing.id, { clockedInAt: at, reviewedAt: at });
    else await repositories.attendance.create({ id: newId('att'), dutyId, clockedInAt: at, reviewedAt: at });
    const person = await repositories.staff.get(duty.staffId);
    await activityService.log(`${person?.name ?? 'A team member'} marked as arrived for the ${duty.shift.toLowerCase()} shift`, 'success', `/app/staff?tab=roster&focus=${dutyId}`);
  },

  reviewLate: (attendanceId: ID) => repositories.attendance.update(attendanceId, { reviewedAt: new Date().toISOString() }),
};
