import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CLEANING_STATUS, MAINTENANCE_STATUS, PRIORITY, ROOM_STATUS, TASK_STATUS, TASK_TYPE } from '@/app/labels';
import { useAuth } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Badge, Button, DataTable, EmptyState, IconButton, Modal, PageHead, PageLoading, Panel, SearchInput, SelectField, StatCard, StatGrid, Tabs, TextAreaField, TextField, useFeedback, type Column } from '@/components/ui';
import { useLookups, type Lookups } from '@/features/useLookups';
import { useResource } from '@/hooks/useResource';
import { today } from '@/lib/dates';
import { fmtDate, timeAgo } from '@/lib/format';
import { errorMessage, hasErrors, required } from '@/lib/validation';
import { housekeepingService, maintenanceService, roomService, staffService } from '@/services';
import type { CleaningStatus, HousekeepingTask, MaintenanceRequest, MaintenanceStatus, Priority, Room, Staff, TaskType } from '@/types/domain';

type Tab = 'schedule' | 'rooms' | 'maintenance';

function TaskForm({ task, lookups, keepers, defaultDate, onClose }: { task?: HousekeepingTask; lookups: Lookups; keepers: Staff[]; defaultDate: string; onClose: () => void }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    roomId: task?.roomId ?? '',
    type: task?.type ?? ('stayover' as TaskType),
    date: task?.date ?? defaultDate,
    time: task?.time ?? '10:00',
    assigneeId: task?.assigneeId ?? '',
    priority: task?.priority ?? ('normal' as Priority),
    notes: task?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { roomId: required(form.roomId, 'Room'), date: required(form.date, 'Date') };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      const payload = { ...form, assigneeId: form.assigneeId || null };
      if (task) await housekeepingService.update(task.id, payload);
      else await housekeepingService.create(payload);
      toast(task ? 'Task updated' : 'Task scheduled');
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={task ? 'Edit cleaning task' : 'Schedule a cleaning task'}
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="task-form">{task ? 'Save task' : 'Schedule task'}</Button></>}
    >
      <form id="task-form" className="form-grid" onSubmit={submit} noValidate>
        <SelectField label="Room" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} error={errors.roomId}>
          <option value="">Choose a room</option>
          {lookups.rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number}</option>)}
        </SelectField>
        <SelectField label="Task" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}>
          {(Object.keys(TASK_TYPE) as TaskType[]).map((t) => <option key={t} value={t}>{TASK_TYPE[t]}</option>)}
        </SelectField>
        <TextField label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.date} />
        <TextField label="Time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <SelectField label="Assign to" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
          <option value="">Unassigned</option>
          {keepers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <SelectField label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
          {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
        </SelectField>
        <TextAreaField label="Notes" wrapClass="full" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

function MaintenanceForm({ lookups, onClose }: { lookups: Lookups; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const [form, setForm] = useState({ roomId: '', title: '', description: '', priority: 'normal' as Priority, takeOffline: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const room = lookups.roomById.get(form.roomId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { roomId: required(form.roomId, 'Room'), title: required(form.title, 'Problem') };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      await maintenanceService.create({ ...form, reportedBy: user?.name ?? 'Team', assigneeId: null });
      toast('Maintenance request logged');
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title="Report a maintenance problem"
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="maintenance-form">Log request</Button></>}
    >
      <form id="maintenance-form" className="form-grid" onSubmit={submit} noValidate>
        <SelectField label="Room" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} error={errors.roomId}>
          <option value="">Choose a room</option>
          {lookups.rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} · {ROOM_STATUS[r.status].label}</option>)}
        </SelectField>
        <SelectField label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
          {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
        </SelectField>
        <TextField label="What's wrong?" wrapClass="full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} autoComplete="off" />
        <TextAreaField label="Details" wrapClass="full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label className="check full">
          <input type="checkbox" checked={form.takeOffline} disabled={room?.status === 'occupied'} onChange={(e) => setForm({ ...form, takeOffline: e.target.checked })} />
          Take this room out of service until it is fixed{room?.status === 'occupied' ? ' (not possible while a guest is in the room)' : ''}
        </label>
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

export default function Housekeeping() {
  const lookups = useLookups();
  const { can, user } = useAuth();
  const { run, confirm } = useFeedback();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'schedule';
  // Set when arriving from Quick Actions, to show that one record. Changing tab clears it.
  const focusId = params.get('focus');
  const [date, setDate] = useState(today());
  const [statusFilter, setStatusFilter] = useState('');
  const [assignee, setAssignee] = useState('');
  const [taskDialog, setTaskDialog] = useState<HousekeepingTask | 'new' | null>(null);
  const [reporting, setReporting] = useState(false);
  const [roomQuery, setRoomQuery] = useState('');
  const [cleaningFilter, setCleaningFilter] = useState('');

  const { data } = useResource(async () => {
    const [tasks, maintenance, staff] = await Promise.all([housekeepingService.list(), maintenanceService.list(), staffService.list()]);
    return { tasks, maintenance, staff };
  });

  const keepers = useMemo(() => (data?.staff ?? []).filter((s) => s.active && s.department === 'Housekeeping'), [data]);
  const engineers = useMemo(() => (data?.staff ?? []).filter((s) => s.active && s.department === 'Maintenance'), [data]);
  const nameById = useMemo(() => new Map((data?.staff ?? []).map((s) => [s.id, s.name])), [data]);

  if (!lookups || !data) return <PageLoading />;

  const canWork = can('housekeeping.work');
  const canAssign = can('housekeeping.assign');
  const roomNumber = (id: string) => lookups.roomById.get(id)?.number ?? '–';

  const focusNotice = (what: string) =>
    focusId && (
      <div className="toolbar">
        <span className="small muted">Showing the {what} you opened from Quick Actions.</span>
        <Button size="sm" onClick={() => setParams(tab === 'schedule' ? {} : { tab })}>Show all</Button>
      </div>
    );

  const tasks = focusId ? data.tasks.filter((t) => t.id === focusId) : data.tasks
    .filter((t) => t.date === date)
    .filter((t) => !statusFilter || t.status === statusFilter)
    .filter((t) => !assignee || (assignee === 'none' ? !t.assigneeId : t.assigneeId === assignee))
    .sort((a, b) => a.status.localeCompare(b.status) || a.time.localeCompare(b.time));

  const taskColumns: Column<HousekeepingTask>[] = [
    { key: 'room', header: 'Room', primary: true, sort: (t) => roomNumber(t.roomId), render: (t) => <span className="cell-title">Room {roomNumber(t.roomId)}</span> },
    {
      key: 'task',
      header: 'Task',
      render: (t) => (
        <>
          <div>{TASK_TYPE[t.type]}</div>
          {t.notes && <div className="cell-sub">{t.notes}</div>}
        </>
      ),
    },
    { key: 'time', header: 'Time', sort: (t) => t.time, render: (t) => t.time || 'As soon as possible' },
    { key: 'priority', header: 'Priority', render: (t) => <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge> },
    {
      key: 'assignee',
      header: 'Assigned to',
      render: (t) =>
        canAssign ? (
          <select
            className="input input-sm"
            aria-label={`Assign room ${roomNumber(t.roomId)}`}
            value={t.assigneeId ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => run(() => housekeepingService.assign(t.id, e.target.value || null), e.target.value ? `Assigned to ${nameById.get(e.target.value)}` : 'Task unassigned')}
          >
            <option value="">Unassigned</option>
            {keepers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : (
          (t.assigneeId && nameById.get(t.assigneeId)) || <span className="muted">Unassigned</span>
        ),
    },
    { key: 'status', header: 'Status', render: (t) => <Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge> },
    {
      key: 'act',
      header: 'Actions',
      actions: true,
      render: (t) =>
        canWork ? (
          <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            {t.status === 'pending' && <Button size="sm" onClick={() => run(() => housekeepingService.start(t.id), `Room ${roomNumber(t.roomId)} started`)}>Start</Button>}
            {t.status === 'in_progress' && <Button size="sm" variant="primary" icon="check" onClick={() => run(() => housekeepingService.complete(t.id), `Room ${roomNumber(t.roomId)} is clean`)}>Done</Button>}
            {t.status === 'done' && <Button size="sm" onClick={() => run(() => housekeepingService.reopen(t.id), 'Task reopened')}>Reopen</Button>}
            <IconButton icon="edit" label="Edit task" onClick={() => setTaskDialog(t)} />
            <IconButton
              icon="trash"
              label="Delete task"
              onClick={async () => {
                const ok = await confirm({ title: 'Delete this task?', message: `${TASK_TYPE[t.type]} for room ${roomNumber(t.roomId)}.`, confirmLabel: 'Delete', danger: true });
                if (ok) run(() => housekeepingService.remove(t.id), 'Task deleted');
              }}
            />
          </div>
        ) : null,
    },
  ];

  const rooms = lookups.rooms
    .filter((r) => !cleaningFilter || r.cleaning === cleaningFilter)
    .filter((r) => !roomQuery || r.number.includes(roomQuery.trim()));

  const roomColumns: Column<Room>[] = [
    { key: 'room', header: 'Room', primary: true, sort: (r) => r.number, render: (r) => <span className="cell-title">Room {r.number}</span> },
    { key: 'status', header: 'Occupancy', render: (r) => <Badge tone={ROOM_STATUS[r.status].tone}>{ROOM_STATUS[r.status].label}</Badge> },
    { key: 'cleaning', header: 'Cleaning', sort: (r) => r.cleaning, render: (r) => <Badge tone={CLEANING_STATUS[r.cleaning].tone}>{CLEANING_STATUS[r.cleaning].label}</Badge> },
    {
      key: 'act',
      header: 'Update',
      actions: true,
      render: (r) =>
        can('rooms.status') ? (
          <select
            className="input input-sm"
            aria-label={`Set cleaning status for room ${r.number}`}
            value={r.cleaning}
            onChange={(e) => run(() => roomService.setCleaning(r.id, e.target.value as CleaningStatus), `Room ${r.number} updated`)}
          >
            {(Object.keys(CLEANING_STATUS) as CleaningStatus[]).map((c) => <option key={c} value={c}>{CLEANING_STATUS[c].label}</option>)}
          </select>
        ) : null,
    },
  ];

  const maintenanceColumns: Column<MaintenanceRequest>[] = [
    {
      key: 'title',
      header: 'Problem',
      primary: true,
      render: (m) => (
        <>
          <div className="cell-title">{m.title}</div>
          <div className="cell-sub">Room {roomNumber(m.roomId)} · reported by {m.reportedBy} {timeAgo(m.createdAt)}{m.roomOffline ? ' · room out of service' : ''}</div>
        </>
      ),
    },
    { key: 'priority', header: 'Priority', sort: (m) => m.priority, render: (m) => <Badge tone={PRIORITY[m.priority].tone}>{PRIORITY[m.priority].label}</Badge> },
    {
      key: 'assignee',
      header: 'Engineer',
      render: (m) =>
        canAssign && m.status !== 'resolved' ? (
          <select
            className="input input-sm"
            aria-label={`Assign engineer for ${m.title}`}
            value={m.assigneeId ?? ''}
            onChange={(e) => run(() => maintenanceService.update(m.id, { assigneeId: e.target.value || null, status: e.target.value && m.status === 'open' ? 'in_progress' : m.status }), 'Engineer updated')}
          >
            <option value="">Unassigned</option>
            {engineers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : (
          (m.assigneeId && nameById.get(m.assigneeId)) || <span className="muted">Unassigned</span>
        ),
    },
    { key: 'status', header: 'Status', sort: (m) => m.status, render: (m) => <Badge tone={MAINTENANCE_STATUS[m.status].tone}>{MAINTENANCE_STATUS[m.status].label}</Badge> },
    {
      key: 'act',
      header: 'Actions',
      actions: true,
      render: (m) =>
        canWork && m.status !== 'resolved' ? (
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            {m.status === 'open' && <Button size="sm" onClick={() => run(() => maintenanceService.update(m.id, { status: 'in_progress' as MaintenanceStatus }), 'Work started')}>Start</Button>}
            <Button size="sm" variant="primary" icon="check" onClick={() => run(() => maintenanceService.resolve(m.id), 'Marked as resolved')}>Resolve</Button>
          </div>
        ) : null,
    },
  ];

  const openTaskCount = data.tasks.filter((t) => t.date === today() && t.status !== 'done').length;
  const openMaintenance = data.maintenance.filter((m) => m.status !== 'resolved').length;
  const dirty = lookups.rooms.filter((r) => r.cleaning !== 'clean').length;
  const tasksToday = data.tasks.filter((t) => t.date === today());
  const doneToday = tasksToday.length - openTaskCount;
  const unassignedToday = tasksToday.filter((t) => !t.assigneeId && t.status !== 'done').length;

  return (
    <>
      <PageHead
        title="Housekeeping"
        subtitle={`${dirty} rooms to clean · ${openMaintenance} maintenance requests open`}
        actions={
          <>
            <Button icon="wrench" onClick={() => setReporting(true)}>Report a problem</Button>
            {canWork && <Button variant="primary" icon="plus" onClick={() => setTaskDialog('new')}>Schedule task</Button>}
          </>
        }
      />
      <StatGrid>
        <StatCard icon="broom" tone="warn" label="Rooms to clean" value={dirty} note="Dirty or being cleaned" to="/app/housekeeping?tab=rooms" />
        <StatCard icon="tasks" label="Today's tasks" value={`${doneToday} / ${tasksToday.length}`} note={`${openTaskCount} still open`} meter={tasksToday.length ? (doneToday / tasksToday.length) * 100 : 100} to="/app/housekeeping" />
        <StatCard icon="hourglass" tone="gold" label="Waiting for an owner" value={unassignedToday} note="Unassigned today" to="/app/housekeeping" />
        <StatCard icon="wrench" tone="bad" label="Maintenance open" value={openMaintenance} note="Requests in progress" to="/app/housekeeping?tab=maintenance" />
      </StatGrid>
      <Panel>
        <div style={{ padding: '4px 14px 0' }}>
          <Tabs
            value={tab}
            onChange={(id) => setParams(id === 'schedule' ? {} : { tab: id })}
            tabs={[
              { id: 'schedule', label: 'Cleaning schedule', count: openTaskCount },
              { id: 'rooms', label: 'Room status', count: dirty },
              { id: 'maintenance', label: 'Maintenance', count: openMaintenance },
            ]}
          />
        </div>
        {tab === 'schedule' && (
          <>
            {focusNotice('task')}
            {!focusId && <div className="toolbar">
              <input className="input" type="date" aria-label="Schedule date" value={date} onChange={(e) => setDate(e.target.value || today())} />
              <select className="input" aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select className="input" aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Everyone</option>
                <option value="none">Unassigned</option>
                {keepers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {user?.staffId && keepers.some((k) => k.id === user.staffId) && (
                <Button size="sm" onClick={() => setAssignee(user.staffId!)}>My tasks</Button>
              )}
            </div>}
            <DataTable
              key={date}
              caption={`Cleaning schedule for ${fmtDate(date)}`}
              columns={taskColumns}
              rows={tasks}
              rowKey={(t) => t.id}
              empty={<EmptyState icon="broom" title="Nothing scheduled" message={`No matching cleaning tasks for ${fmtDate(date)}.`} />}
            />
          </>
        )}
        {tab === 'rooms' && (
          <>
            <div className="toolbar">
              <SearchInput value={roomQuery} onChange={setRoomQuery} placeholder="Room number" />
              <select className="input" aria-label="Cleaning state" value={cleaningFilter} onChange={(e) => setCleaningFilter(e.target.value)}>
                <option value="">Any cleaning state</option>
                {Object.entries(CLEANING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <DataTable caption="Room cleaning status" columns={roomColumns} rows={rooms} rowKey={(r) => r.id} pageSize={15} empty={<EmptyState icon="bed" title="No rooms match" />} />
          </>
        )}
        {tab === 'maintenance' && (
          <>
          {focusNotice('request')}
          <DataTable
            caption="Maintenance requests"
            columns={maintenanceColumns}
            rows={[...data.maintenance].filter((m) => !focusId || m.id === focusId).sort((a, b) => (a.status === 'resolved' ? 1 : 0) - (b.status === 'resolved' ? 1 : 0) || b.createdAt.localeCompare(a.createdAt))}
            rowKey={(m) => m.id}
            empty={<EmptyState icon="wrench" title="Nothing needs fixing" message="New maintenance requests will appear here." />}
          />
          </>
        )}
      </Panel>

      {taskDialog && (
        <TaskForm task={taskDialog === 'new' ? undefined : taskDialog} lookups={lookups} keepers={keepers} defaultDate={date} onClose={() => setTaskDialog(null)} />
      )}
      {reporting && <MaintenanceForm lookups={lookups} onClose={() => setReporting(false)} />}
    </>
  );
}
