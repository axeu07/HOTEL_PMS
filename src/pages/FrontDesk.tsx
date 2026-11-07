import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CLEANING_STATUS, RESERVATION_STATUS, SOURCE_LABEL } from '@/app/labels';
import { Badge, Button, DataTable, EmptyState, PageHead, PageLoading, Panel, PersonCell, SearchInput, StatCard, StatGrid, Tabs, type Column } from '@/components/ui';
import { GuestIdQrPanel, QrRegistrationsPanel } from '@/features/guestRegistration';
import { CheckInModal, CheckOutModal, ReservationDetailModal, ReservationFormModal } from '@/features/reservations';
import { useLookups } from '@/features/useLookups';
import { useResource } from '@/hooks/useResource';
import { addDays, today } from '@/lib/dates';
import { samePhone } from '@/lib/phone';
import { fmtDate, fmtDayMonth, fmtWeekday, money } from '@/lib/format';
import { billingService, guestName, guestService, registrationService } from '@/services';
import type { Reservation } from '@/types/domain';

type Tab = 'arrivals' | 'departures' | 'inhouse' | 'allocate' | 'all' | 'registrations' | 'qr';
type ReservationTab = Exclude<Tab, 'registrations' | 'qr'>;

export default function FrontDesk() {
  const lookups = useLookups();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'arrivals';
  const [query, setQuery] = useState('');
  const [walkIn, setWalkIn] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const newGuest = params.get('guest') ?? undefined;
  const [walkInPhone, setWalkInPhone] = useState('');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  // "New booking" links elsewhere in the app (dashboard, guest profiles) arrive here with ?new=1.
  useEffect(() => {
    if (params.get('new') === '1') {
      setCreating(true);
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const { data: invoices } = useResource(() => billingService.listViews());
  const balanceByReservation = useMemo(
    () => new Map((invoices ?? []).map((v) => [v.invoice.reservationId, v.totals.balance])),
    [invoices],
  );

  const { data: registrations } = useResource(() => registrationService.list());
  const pendingRegistrations = (registrations ?? []).filter((r) => r.status === 'pending').length;

  const now = today();
  const name = (r: Reservation) => guestName(lookups?.guestById.get(r.guestId));

  const groups = useMemo(() => {
    const rows = lookups?.reservations ?? [];
    return {
      arrivals: rows.filter((r) => r.checkIn === now && ['confirmed', 'pending'].includes(r.status)),
      departures: rows.filter((r) => r.checkOut <= now && r.status === 'checked_in'),
      inhouse: rows.filter((r) => r.status === 'checked_in'),
      allocate: rows
        .filter((r) => !r.roomId && ['confirmed', 'pending'].includes(r.status) && r.checkIn <= addDays(now, 7) && r.checkIn >= now)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
      all: rows,
    };
  }, [lookups, now]);

  if (!lookups) return <PageLoading />;

  const q = query.trim().toLowerCase();
  const isReservationTab = tab !== 'registrations' && tab !== 'qr';
  const rt: ReservationTab = isReservationTab ? tab : 'arrivals';
  const filtered = groups[rt].filter((r) => (rt !== 'all' || !statusFilter || r.status === statusFilter) && (!q || `${name(r)} ${r.code} ${r.roomId ? lookups.roomById.get(r.roomId)?.number : ''}`.toLowerCase().includes(q)));

  const guestCell = (r: Reservation) => (
    <PersonCell name={name(r)} vip={lookups.guestById.get(r.guestId)?.vip} sub={`${r.code} · ${lookups.categoryById.get(r.categoryId)?.name}`} />
  );

  const roomCell = (r: Reservation) => {
    const room = r.roomId ? lookups.roomById.get(r.roomId) : null;
    if (!room) return <Badge tone="warn">No room yet</Badge>;
    if (r.status === 'checked_in') return <span className="strong">{room.number}</span>;
    if (room.status === 'occupied') return <span className="row"><span className="strong">{room.number}</span><Badge tone="warn">Guest leaving</Badge></span>;
    return <span className="row"><span className="strong">{room.number}</span><Badge tone={CLEANING_STATUS[room.cleaning].tone}>{CLEANING_STATUS[room.cleaning].label}</Badge></span>;
  };

  const balanceCell = (r: Reservation) => {
    const balance = balanceByReservation.get(r.id) ?? 0;
    return balance > 0 ? <span className="strong">{money(balance)}</span> : <Badge tone="good">Settled</Badge>;
  };

  const columns: Record<ReservationTab, Column<Reservation>[]> = {
    arrivals: [
      { key: 'guest', header: 'Guest', primary: true, render: guestCell, sort: name },
      { key: 'nights', header: 'Until', render: (r) => fmtDayMonth(r.checkOut) },
      { key: 'room', header: 'Room', render: roomCell },
      { key: 'balance', header: 'Balance', num: true, render: balanceCell },
      { key: 'act', header: 'Actions', actions: true, render: (r) => <Button size="sm" variant="primary" icon="key" onClick={() => setCheckingIn(r.id)}>Check in</Button> },
    ],
    departures: [
      { key: 'guest', header: 'Guest', primary: true, render: guestCell, sort: name },
      { key: 'stay', header: 'Arrived', render: (r) => fmtDayMonth(r.checkIn) },
      { key: 'room', header: 'Room', render: roomCell },
      { key: 'balance', header: 'Balance', num: true, render: balanceCell },
      { key: 'act', header: 'Actions', actions: true, render: (r) => <Button size="sm" variant="primary" icon="logout" onClick={() => setCheckingOut(r.id)}>Check out</Button> },
    ],
    inhouse: [
      { key: 'guest', header: 'Guest', primary: true, render: guestCell, sort: name },
      { key: 'room', header: 'Room', render: roomCell, sort: (r) => lookups.roomById.get(r.roomId ?? '')?.number ?? '' },
      { key: 'until', header: 'Leaving', render: (r) => fmtDate(r.checkOut), sort: (r) => r.checkOut },
      { key: 'balance', header: 'Balance', num: true, render: balanceCell },
      { key: 'act', header: 'Actions', actions: true, render: (r) => <Button size="sm" icon="logout" onClick={() => setCheckingOut(r.id)}>Check out</Button> },
    ],
    all: [
      { key: 'guest', header: 'Guest', primary: true, render: guestCell, sort: name },
      { key: 'in', header: 'Check-in', render: (r) => fmtDate(r.checkIn), sort: (r) => r.checkIn },
      { key: 'out', header: 'Check-out', hideOnMobile: true, render: (r) => fmtDate(r.checkOut), sort: (r) => r.checkOut },
      { key: 'room', header: 'Room', render: roomCell },
      { key: 'status', header: 'Status', sort: (r) => r.status, render: (r) => <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge> },
      { key: 'source', header: 'Source', hideOnMobile: true, render: (r) => SOURCE_LABEL[r.source] },
      { key: 'balance', header: 'Balance', num: true, hideOnMobile: true, render: balanceCell },
    ],
    allocate: [
      { key: 'guest', header: 'Guest', primary: true, render: guestCell, sort: name },
      { key: 'in', header: 'Arriving', render: (r) => fmtDate(r.checkIn), sort: (r) => r.checkIn },
      { key: 'out', header: 'Leaving', render: (r) => fmtDate(r.checkOut) },
      {
        key: 'room',
        header: 'Allocate',
        actions: true,
        render: (r) => <Button size="sm" icon="bed" onClick={() => setOpened(r.id)}>Choose a room</Button>,
      },
    ],
  };

  const emptyText: Record<ReservationTab, { title: string; message: string }> = {
    arrivals: { title: 'No more arrivals today', message: 'Everyone expected today has been checked in.' },
    departures: { title: 'No more departures today', message: 'Every guest leaving today has been checked out.' },
    inhouse: { title: 'The house is empty', message: 'No guests are currently checked in.' },
    allocate: { title: 'Every booking has a room', message: 'All bookings in the next seven days are allocated.' },
    all: { title: 'No bookings yet', message: 'Create a reservation, or take a walk-in.' },
  };

  // After a QR registration is verified: a guest with a booking due today goes to check-in, anyone else to the walk-in form.
  const continueAfterVerify = async (phone: string) => {
    const known = (await guestService.list()).find((g) => samePhone(g.phone, phone));
    const arrival = known && groups.arrivals.find((r) => r.guestId === known.id);
    if (arrival) setCheckingIn(arrival.id);
    else { setWalkInPhone(phone); setWalkIn(true); }
  };

  const checkInTarget = lookups.reservations.find((r) => r.id === checkingIn);
  const checkOutTarget = lookups.reservations.find((r) => r.id === checkingOut);

  return (
    <>
      <PageHead
        title="Front Desk"
        subtitle={`${fmtWeekday(now)} · walk-ins, new reservations and every booking, from arrival to departure.`}
        actions={
          <>
            <Button icon="calendar" onClick={() => setCreating(true)}>New reservation</Button>
            <Button variant="primary" icon="plus" onClick={() => setWalkIn(true)}>Walk-in booking</Button>
          </>
        }
      />
      <StatGrid>
        <StatCard icon="login" label="Arrivals to check in" value={groups.arrivals.length} note="Expected today" to="/app/front-desk" />
        <StatCard icon="logout" tone="info" label="Departures to check out" value={groups.departures.length} note="Due today" to="/app/front-desk?tab=departures" />
        <StatCard icon="users" tone="gold" label="Guests in house" value={groups.inhouse.length} note="Rooms occupied" to="/app/front-desk?tab=inhouse" />
        <StatCard icon="bed" tone={groups.allocate.length ? 'warn' : 'good'} label="Rooms to allocate" value={groups.allocate.length} note="Arriving within 7 days" to="/app/front-desk?tab=allocate" />
      </StatGrid>
      <Panel>
        <div style={{ padding: '4px 14px 0' }}>
          <Tabs
            value={tab}
            onChange={(id) => setParams(id === 'arrivals' ? {} : { tab: id })}
            tabs={[
              { id: 'arrivals', label: "Today's arrivals", count: groups.arrivals.length },
              { id: 'departures', label: "Today's departures", count: groups.departures.length },
              { id: 'inhouse', label: 'In house', count: groups.inhouse.length },
              { id: 'allocate', label: 'Room allocation', count: groups.allocate.length },
              { id: 'all', label: 'All bookings', count: groups.all.length },
              { id: 'qr', label: 'Guest ID QR' },
              { id: 'registrations', label: 'QR registrations', count: pendingRegistrations },
            ]}
          />
        </div>
        {isReservationTab && (<>
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by guest, booking or room" />
          {tab === 'all' && (
            <select className="input" aria-label="Booking status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Every status</option>
              {Object.entries(RESERVATION_STATUS).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
          )}
        </div>
        <DataTable
          key={tab}
          caption={tab}
          columns={columns[rt]}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpened(r.id)}
          empty={q ? <EmptyState title="No matches" message="Try another name or booking number." /> : <EmptyState icon="check" {...emptyText[rt]} />}
        />
        </>)}
      </Panel>
      {tab === 'qr' && <GuestIdQrPanel />}
      {tab === 'registrations' && <QrRegistrationsPanel onProceed={continueAfterVerify} />}

      {creating && <ReservationFormModal lookups={lookups} defaults={newGuest ? { guestId: newGuest } : undefined} onClose={() => { setCreating(false); if (newGuest) { const next = new URLSearchParams(params); next.delete('guest'); setParams(next, { replace: true }); } }} onSaved={(r) => setOpened(r.id)} />}
      {walkIn && <ReservationFormModal lookups={lookups} walkIn initialPhone={walkInPhone} onClose={() => { setWalkIn(false); setWalkInPhone(''); }} />}
      {checkInTarget && <CheckInModal reservation={checkInTarget} lookups={lookups} onClose={() => setCheckingIn(null)} />}
      {checkOutTarget && <CheckOutModal reservation={checkOutTarget} lookups={lookups} onClose={() => setCheckingOut(null)} />}
      {opened && <ReservationDetailModal reservationId={opened} lookups={lookups} onClose={() => setOpened(null)} />}
    </>
  );
}
