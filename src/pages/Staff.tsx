import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers';
import { Icon, type IconName } from '@/components/icons';
import { Badge, Button, DataTable, EmptyState, IconButton, Modal, PageHead, PageLoading, Panel, PersonCell, SearchInput, SelectField, StatCard, StatGrid, Tabs, TextField, useFeedback, type Column } from '@/components/ui';
import { attendanceState, SHIFT_WINDOWS, type AttendanceState } from '@/domain/attendance';
import { useFocusedRecord } from '@/hooks/useFocusedRecord';
import { useResource } from '@/hooks/useResource';
import { today } from '@/lib/dates';
import { fmtDate } from '@/lib/format';
import { errorMessage, hasErrors, required, validEmail, validPhone } from '@/lib/validation';
import { authService, staffService } from '@/services';
import type { Department, DutyAssignment, Shift, Staff } from '@/types/domain';

const DEPARTMENTS: Department[] = ['Management', 'Front Office', 'Housekeeping', 'Food & Beverage', 'Maintenance'];
const SHIFTS: Shift[] = ['Morning', 'Evening', 'Night'];
const SHIFT_HOURS = Object.fromEntries(SHIFTS.map((s) => [s, `${SHIFT_WINDOWS[s].start}–${SHIFT_WINDOWS[s].end}`])) as Record<Shift, string>;
const ATTENDANCE_BADGE: Record<Exclude<AttendanceState, 'upcoming'>, { label: string; tone: 'good' | 'warn' | 'bad' }> = {
  present: { label: 'Arrived', tone: 'good' },
  late: { label: 'Arrived late', tone: 'warn' },
  absent: { label: 'Not checked in', tone: 'bad' },
};
const SHIFT_ICON: Record<Shift, IconName> = { Morning: 'sun', Evening: 'clock', Night: 'moon' };

function StaffForm({ person, onClose }: { person?: Staff; onClose: () => void }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    name: person?.name ?? '',
    jobTitle: person?.jobTitle ?? '',
    department: person?.department ?? ('Front Office' as Department),
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    active: person?.active ?? true,
    joinedOn: person?.joinedOn ?? today(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      name: required(form.name, 'Name'),
      jobTitle: required(form.jobTitle, 'Job title'),
      email: validEmail(form.email),
      phone: required(form.phone, 'Phone') || validPhone(form.phone),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      await staffService.save({ ...form, id: person?.id });
      toast(person ? `${form.name} updated` : `${form.name} added to the team`);
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={person ? `Edit ${person.name}` : 'Add a team member'}
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="staff-form">{person ? 'Save' : 'Add to team'}</Button></>}
    >
      <form id="staff-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="Full name" wrapClass="full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} autoComplete="off" />
        <TextField label="Job title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} error={errors.jobTitle} autoComplete="off" />
        <SelectField label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value as Department })}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </SelectField>
        <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} autoComplete="off" />
        <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} autoComplete="off" />
        <TextField label="Joined on" type="date" value={form.joinedOn} onChange={(e) => setForm({ ...form, joinedOn: e.target.value })} />
        <label className="check" style={{ alignSelf: 'end', paddingBottom: 9 }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Currently active
        </label>
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

function DutyForm({ staff, date, duty, onClose }: { staff: Staff[]; date: string; duty?: DutyAssignment; onClose: () => void }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ staffId: duty?.staffId ?? '', date: duty?.date ?? date, shift: duty?.shift ?? ('Morning' as Shift), area: duty?.area ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { staffId: required(form.staffId, 'Team member'), area: required(form.area, 'Area') };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      await staffService.saveDuty({ ...form, id: duty?.id });
      toast('Duty saved');
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={duty ? 'Edit duty' : 'Assign a duty'}
      size="sm"
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="duty-form">Save duty</Button></>}
    >
      <form id="duty-form" className="stack" onSubmit={submit} noValidate>
        <SelectField label="Team member" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} error={errors.staffId}>
          <option value="">Choose a person</option>
          {staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department}</option>)}
        </SelectField>
        <TextField label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <SelectField label="Shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value as Shift })}>
          {SHIFTS.map((s) => <option key={s} value={s}>{s} ({SHIFT_HOURS[s]})</option>)}
        </SelectField>
        <TextField label="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} error={errors.area} autoComplete="off" />
        {failure && <div className="alert alert-bad"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

export default function StaffPage() {
  const { can } = useAuth();
  const { run, confirm } = useFeedback();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'directory' | 'roster' | 'roles'>(params.get('tab') === 'roster' ? 'roster' : 'directory');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [date, setDate] = useState(today());
  const [staffDialog, setStaffDialog] = useState<Staff | 'new' | null>(null);
  const [dutyDialog, setDutyDialog] = useState<DutyAssignment | 'new' | null>(null);
  const manage = can('staff.manage');

  const { data } = useResource(async () => {
    const [staff, duties, users, roles, attendance] = await Promise.all([staffService.list(), staffService.duties(), authService.demoAccounts(), authService.roles(), staffService.attendance()]);
    return { staff, duties, users, roles, attendance };
  });
  const focusId = useFocusedRecord(!!data);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.staff ?? []).filter((s) => (!department || s.department === department) && (!q || `${s.name} ${s.jobTitle} ${s.email}`.toLowerCase().includes(q)));
  }, [data, query, department]);

  if (!data) return <PageLoading />;

  const nameOf = (id: string) => data.staff.find((s) => s.id === id)?.name ?? 'Former staff';
  const roleOf = (staffId: string) => {
    const user = data.users.find((u) => u.staffId === staffId);
    return user ? data.roles.find((r) => r.id === user.roleId)?.name : undefined;
  };

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sort: (s) => s.name,
      render: (s) => (
        <PersonCell name={s.name} sub={s.jobTitle} />
      ),
    },
    { key: 'dept', header: 'Department', sort: (s) => s.department, render: (s) => s.department },
    { key: 'access', header: 'System role', hideOnMobile: true, render: (s) => roleOf(s.id) ?? <span className="muted">No login</span> },
    { key: 'contact', header: 'Contact', hideOnMobile: true, render: (s) => <><div>{s.phone}</div><div className="cell-sub">{s.email}</div></> },
    { key: 'status', header: 'Status', sort: (s) => String(s.active), render: (s) => <Badge tone={s.active ? 'good' : 'quiet'}>{s.active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'act',
      header: 'Actions',
      actions: true,
      render: (s) =>
        manage ? (
          <div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
            <IconButton icon="edit" label={`Edit ${s.name}`} onClick={() => setStaffDialog(s)} />
            <IconButton
              icon="trash"
              label={`Remove ${s.name}`}
              onClick={async () => {
                const ok = await confirm({ title: `Remove ${s.name}?`, message: 'Their duties are removed and open tasks become unassigned.', confirmLabel: 'Remove', danger: true });
                if (ok) run(() => staffService.remove(s.id), `${s.name} removed`);
              }}
            />
          </div>
        ) : null,
    },
  ];

  const duties = data.duties.filter((d) => d.date === date);
  const active = data.staff.filter((s) => s.active);

  return (
    <>
      <PageHead
        title="Staff"
        subtitle={`${data.staff.filter((s) => s.active).length} active team members`}
        actions={manage && (tab === 'roster'
          ? <Button variant="primary" icon="plus" onClick={() => setDutyDialog('new')}>Assign duty</Button>
          : <Button variant="primary" icon="plus" onClick={() => setStaffDialog('new')}>Add team member</Button>)}
      />
      <StatGrid>
        <StatCard icon="users" label="Active team" value={active.length} note={`${data.staff.length} on the books`} />
        <StatCard icon="calendarCheck" tone="good" label="On duty today" value={data.duties.filter((d) => d.date === today()).length} note="Across all shifts" />
        <StatCard icon="building" tone="gold" label="Departments" value={new Set(active.map((s) => s.department)).size} note="With active staff" />
        <StatCard icon="shield" tone="info" label="System logins" value={data.users.length} note={`${data.roles.length} access roles`} />
      </StatGrid>
      <div style={{ marginBottom: 16 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'directory', label: 'Directory', count: data.staff.length },
            { id: 'roster', label: 'Duty roster' },
            { id: 'roles', label: 'Roles & access', count: data.roles.length },
          ]}
        />
      </div>

      {tab === 'directory' && (
        <Panel>
          <div className="toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Name, job title or email" />
            <select className="input" aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <DataTable caption="Staff directory" columns={columns} rows={rows} rowKey={(s) => s.id} pageSize={15} empty={<EmptyState icon="badge" title="No team members match" />} />
        </Panel>
      )}

      {tab === 'roster' && (
        <Panel>
          <div className="toolbar">
            <label className="row small muted" style={{ gap: 6 }}>Date <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} /></label>
            <span className="small muted">{duties.length} people on duty {fmtDate(date)}</span>
          </div>
          <div className="shift-grid">
            {SHIFTS.map((shift) => {
              const onShift = duties.filter((d) => d.shift === shift);
              return (
                <section key={shift} className="shift-card" aria-label={`${shift} shift`}>
                  <div className="shift-head">
                    <span className="panel-icon"><Icon name={SHIFT_ICON[shift]} /></span>
                    <div>
                      <h3>{shift}</h3>
                      <div className="cell-sub">{SHIFT_HOURS[shift]}</div>
                    </div>
                  </div>
                  {onShift.length === 0 && <p className="shift-empty">Nobody assigned.</p>}
                  <ul className="mini-list">
                    {onShift.map((d) => {
                      // Attendance only means something for today's roster.
                      const state = date === today() ? attendanceState(d, data.attendance.find((a) => a.dutyId === d.id), new Date()) : 'upcoming';
                      return (
                      <li key={d.id} data-focused={d.id === focusId || undefined}>
                        <span className="grow">
                          <span className="cell-title">{nameOf(d.staffId)}</span>
                          <span className="cell-sub" style={{ display: 'block' }}>{d.area}</span>
                          {state !== 'upcoming' && <span className="qa-roster-state"><Badge tone={ATTENDANCE_BADGE[state].tone}>{ATTENDANCE_BADGE[state].label}</Badge></span>}
                        </span>
                        {manage && state === 'absent' && (
                          <Button size="sm" onClick={() => run(() => staffService.markArrived(d.id), `${nameOf(d.staffId)} marked as arrived`)}>Mark arrived</Button>
                        )}
                        {manage && (
                          <>
                            <IconButton icon="edit" label={`Edit duty for ${nameOf(d.staffId)}`} onClick={() => setDutyDialog(d)} />
                            <IconButton icon="trash" label={`Remove duty for ${nameOf(d.staffId)}`} onClick={() => run(() => staffService.removeDuty(d.id), 'Duty removed')} />
                          </>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === 'roles' && (
        <div className="grid-1-1">
          {data.roles.map((role) => {
            const holders = data.users.filter((u) => u.roleId === role.id);
            return (
              <Panel key={role.id} icon="shield" title={role.name} subtitle={role.description}>
                <div className="panel-body">
                  <p className="small"><span className="muted">Demo user:</span> {holders.map((h) => h.name).join(', ') || 'None'}</p>
                  <div className="tag-list" style={{ marginTop: 10 }}>
                    {role.permissions.map((p) => <span key={p} className="tag">{p.replace('.', ': ')}</span>)}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {staffDialog && <StaffForm person={staffDialog === 'new' ? undefined : staffDialog} onClose={() => setStaffDialog(null)} />}
      {dutyDialog && <DutyForm staff={data.staff} date={date} duty={dutyDialog === 'new' ? undefined : dutyDialog} onClose={() => setDutyDialog(null)} />}
    </>
  );
}
