import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RESERVATION_STATUS } from '@/app/labels';
import { useAuth } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Avatar, Badge, Button, DataTable, EmptyState, MiniStat, Modal, PageHead, PageLoading, Panel, PersonCell, SearchInput, SelectField, StatCard, StatGrid, TextAreaField, TextField, useFeedback, type Column } from '@/components/ui';
import { useLookups, type Lookups } from '@/features/useLookups';
import { useResource } from '@/hooks/useResource';
import { nightsBetween } from '@/lib/dates';
import { fmtDate, money } from '@/lib/format';
import { errorMessage, hasErrors, required, validEmail, validPhone } from '@/lib/validation';
import { billingService, emptyGuest, guestName, guestService, type GuestInput } from '@/services';
import type { Guest, GuestPreferences } from '@/types/domain';

const PREF_LABEL = {
  floor: { no_preference: 'No preference', low: 'Lower floor', high: 'Higher floor' },
  bed: { no_preference: 'No preference', king: 'King', twin: 'Twin' },
  pillow: { no_preference: 'No preference', soft: 'Soft', firm: 'Firm', hypoallergenic: 'Hypoallergenic' },
  dietary: { none: 'None', vegetarian: 'Vegetarian', vegan: 'Vegan', jain: 'Jain', gluten_free: 'Gluten free' },
};

function GuestForm({ guest, onClose }: { guest?: Guest; onClose: () => void }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState<GuestInput>(guest ?? emptyGuest());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const set = <K extends keyof GuestInput>(key: K, value: GuestInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setPref = <K extends keyof GuestPreferences>(key: K, value: GuestPreferences[K]) =>
    setForm((f) => ({ ...f, preferences: { ...f.preferences, [key]: value } }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      firstName: required(form.firstName, 'First name'),
      lastName: required(form.lastName, 'Last name'),
      email: validEmail(form.email),
      phone: required(form.phone, 'Phone') || validPhone(form.phone),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      if (guest) await guestService.update(guest.id, form);
      else await guestService.create(form);
      toast(guest ? `${form.firstName}'s profile updated` : `${form.firstName} ${form.lastName} added`);
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={guest ? `Edit ${guestName(guest)}` : 'Add a guest'}
      size="lg"
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="guest-form">{guest ? 'Save guest' : 'Add guest'}</Button></>}
    >
      <form id="guest-form" className="form-grid" onSubmit={submit} noValidate>
        <TextField label="First name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} autoComplete="off" />
        <TextField label="Last name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} autoComplete="off" />
        <TextField label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} autoComplete="off" />
        <TextField label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} autoComplete="off" />
        <TextField label="City" value={form.city} onChange={(e) => set('city', e.target.value)} autoComplete="off" />
        <TextField label="Nationality" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} autoComplete="off" />
        <TextField label="Company" value={form.company} onChange={(e) => set('company', e.target.value)} autoComplete="off" />
        <label className="check" style={{ alignSelf: 'end', paddingBottom: 9 }}>
          <input type="checkbox" checked={form.vip} onChange={(e) => set('vip', e.target.checked)} /> VIP guest
        </label>
        <span className="form-section">Preferences</span>
        <SelectField label="Floor" value={form.preferences.floor} onChange={(e) => setPref('floor', e.target.value as GuestPreferences['floor'])}>
          {Object.entries(PREF_LABEL.floor).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        <SelectField label="Bed" value={form.preferences.bed} onChange={(e) => setPref('bed', e.target.value as GuestPreferences['bed'])}>
          {Object.entries(PREF_LABEL.bed).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        <SelectField label="Pillow" value={form.preferences.pillow} onChange={(e) => setPref('pillow', e.target.value as GuestPreferences['pillow'])}>
          {Object.entries(PREF_LABEL.pillow).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        <SelectField label="Dietary" value={form.preferences.dietary} onChange={(e) => setPref('dietary', e.target.value as GuestPreferences['dietary'])}>
          {Object.entries(PREF_LABEL.dietary).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        <TextAreaField label="Notes for the team" wrapClass="full" value={form.preferences.notes} onChange={(e) => setPref('notes', e.target.value)} />
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}

function GuestProfile({ guest, lookups, onClose }: { guest: Guest; lookups: Lookups; onClose: () => void }) {
  const { can } = useAuth();
  const { run, confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const stays = lookups.reservations
    .filter((r) => r.guestId === guest.id)
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const { data: views } = useResource(() => billingService.listViews(), [guest.id]);
  const spent = useMemo(
    () => (views ?? []).filter((v) => v.invoice.guestId === guest.id && v.invoice.status !== 'void').reduce((s, v) => s + v.totals.paid, 0),
    [views, guest.id],
  );
  const nights = stays.filter((s) => s.status === 'checked_out').reduce((n, s) => n + nightsBetween(s.checkIn, s.checkOut), 0);
  const manage = can('guests.manage');

  return (
    <Modal
      title={guestName(guest)}
      subtitle={guest.company || `Guest since ${fmtDate(guest.createdAt.slice(0, 10))}`}
      size="lg"
      onClose={onClose}
      footer={
        manage ? (
          <>
            <Button
              className="left"
              variant="danger"
              icon="trash"
              onClick={async () => {
                const ok = await confirm({ title: `Delete ${guestName(guest)}?`, message: 'Guests with booking history must be kept.', confirmLabel: 'Delete guest', danger: true });
                if (ok && (await run(() => guestService.remove(guest.id), 'Guest deleted'))) onClose();
              }}
            >
              Delete
            </Button>
            <Link className="btn" to={`/app/reservations?new=1&guest=${guest.id}`}><Icon name="plus" />New booking</Link>
            <Button variant="primary" icon="edit" onClick={() => setEditing(true)}>Edit profile</Button>
          </>
        ) : undefined
      }
    >
      <div className="stack">
        <div className="profile-hero">
          <Avatar name={guestName(guest)} large />
          {guest.vip && <Badge tone="brass">VIP</Badge>}
          <div className="mini-stats grow">
            <MiniStat label="Bookings" value={stays.length} />
            <MiniStat label="Nights stayed" value={nights} />
            <MiniStat label="Paid" value={money(spent)} />
          </div>
        </div>
        <div className="grid-1-1">
          <dl className="dl">
            <dt>Phone</dt><dd>{guest.phone}</dd>
            <dt>Email</dt><dd>{guest.email || '–'}</dd>
            <dt>City</dt><dd>{guest.city || '–'}</dd>
            <dt>Nationality</dt><dd>{guest.nationality || '–'}</dd>
          </dl>
          <dl className="dl">
            <dt>Floor</dt><dd>{PREF_LABEL.floor[guest.preferences.floor]}</dd>
            <dt>Bed</dt><dd>{PREF_LABEL.bed[guest.preferences.bed]}</dd>
            <dt>Pillow</dt><dd>{PREF_LABEL.pillow[guest.preferences.pillow]}</dd>
            <dt>Dietary</dt><dd>{PREF_LABEL.dietary[guest.preferences.dietary]}</dd>
          </dl>
        </div>
        {guest.preferences.notes && <div className="alert alert-info"><Icon name="info" /><span>{guest.preferences.notes}</span></div>}
        <div>
          <h3 style={{ fontSize: 18, marginBottom: 6 }}>Booking history</h3>
          {stays.length === 0 ? (
            <p className="muted">No bookings yet.</p>
          ) : (
            <ul className="mini-list list-box" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {stays.map((r) => (
                <li key={r.id} style={{ padding: '8px 12px' }}>
                  <span className="grow">
                    <Link to={`/app/reservations?open=${r.id}`} className="strong">{r.code}</Link>
                    <span className="cell-sub" style={{ display: 'block' }}>
                      {fmtDate(r.checkIn)} to {fmtDate(r.checkOut)} · {lookups.categoryById.get(r.categoryId)?.name}
                    </span>
                  </span>
                  <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {editing && <GuestForm guest={guest} onClose={() => setEditing(false)} />}
    </Modal>
  );
}

export default function Guests() {
  const lookups = useLookups();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const openId = params.get('open');

  const staysByGuest = useMemo(() => {
    const map = new Map<string, number>();
    lookups?.reservations.forEach((r) => map.set(r.guestId, (map.get(r.guestId) ?? 0) + 1));
    return map;
  }, [lookups]);

  const rows = useMemo(() => {
    if (!lookups) return [];
    const q = query.trim().toLowerCase();
    return lookups.guests.filter((g) => {
      if (vipOnly && !g.vip) return false;
      return !q || `${guestName(g)} ${g.email} ${g.phone} ${g.city} ${g.company}`.toLowerCase().includes(q);
    });
  }, [lookups, query, vipOnly]);

  if (!lookups) return <PageLoading />;
  const open = openId ? lookups.guestById.get(openId) : undefined;
  const inHouseGuests = new Set(lookups.reservations.filter((r) => r.status === 'checked_in').map((r) => r.guestId)).size;
  const returning = [...staysByGuest.values()].filter((count) => count > 1).length;

  const columns: Column<Guest>[] = [
    {
      key: 'name',
      header: 'Guest',
      primary: true,
      sort: (g) => g.lastName,
      render: (g) => (
        <PersonCell name={guestName(g)} sub={g.company || undefined} />
      ),
    },
    { key: 'phone', header: 'Phone', render: (g) => <span className="nowrap">{g.phone}</span> },
    { key: 'email', header: 'Email', hideOnMobile: true, render: (g) => g.email || '–' },
    { key: 'city', header: 'City', sort: (g) => g.city, hideOnMobile: true, render: (g) => g.city || '–' },
    { key: 'stays', header: 'Bookings', num: true, sort: (g) => staysByGuest.get(g.id) ?? 0, render: (g) => staysByGuest.get(g.id) ?? 0 },
    { key: 'vip', header: 'Status', render: (g) => (g.vip ? <Badge tone="brass">VIP</Badge> : <span className="muted">Regular</span>) },
  ];

  return (
    <>
      <PageHead
        title="Guests"
        subtitle={`${lookups.guests.length} guests in the directory`}
        actions={can('guests.manage') && <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add guest</Button>}
      />
      <StatGrid>
        <StatCard icon="users" label="All guests" value={lookups.guests.length} note="In the directory" />
        <StatCard icon="star" tone="gold" label="VIP guests" value={lookups.guests.filter((g) => g.vip).length} note="Flagged for extra care" />
        <StatCard icon="key" tone="good" label="In house now" value={inHouseGuests} note="Staying tonight" />
        <StatCard icon="refresh" tone="info" label="Returning guests" value={returning} note="More than one booking" />
      </StatGrid>
      <Panel>
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Name, email, phone, city or company" />
          <label className="check"><input type="checkbox" checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} /> VIP only</label>
        </div>
        <DataTable
          caption="Guest directory"
          columns={columns}
          rows={rows}
          rowKey={(g) => g.id}
          onRowClick={(g) => setParams({ open: g.id })}
          empty={<EmptyState icon="users" title="No guests match" message="Try another name, or add a new guest." />}
        />
      </Panel>
      {adding && <GuestForm onClose={() => setAdding(false)} />}
      {open && <GuestProfile guest={open} lookups={lookups} onClose={() => setParams({})} />}
    </>
  );
}
