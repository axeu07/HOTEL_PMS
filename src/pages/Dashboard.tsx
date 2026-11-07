import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RESERVATION_STATUS, TASK_TYPE } from '@/app/labels';
import { useApp, useAuth } from '@/app/providers';
import { Bars, SERIES, TrendArea } from '@/components/charts';
import { KpiPanelArt, type KpiArtKind } from '@/components/decor';
import { Icon, type IconName } from '@/components/icons';
import { Badge, Button, DataTable, EmptyState, Meter, PageHead, PageLoading, Panel, PersonCell, StatCard, StatGrid, useFeedback, type Column } from '@/components/ui';
import { LeadDashboard } from '@/features/crm/LeadDashboard';
import { QuickActionCards } from '@/features/QuickActionCards';
import { RoomBoard } from '@/features/rooms';
import { useLookups, type Lookups } from '@/features/useLookups';
import { useResource } from '@/hooks/useResource';
import { today } from '@/lib/dates';
import { fmtDate, fmtDayMonth, fmtWeekday, money, moneyCompact, percent } from '@/lib/format';
import { guestName, housekeepingService, maintenanceService, reportService, type DayRevenue } from '@/services';
import type { Reservation } from '@/types/domain';

/** Share done, for a progress meter. An empty day reads as nothing left to do. */
const shareDone = (done: number, total: number) => (total ? (done / total) * 100 : 100);

function RecentBookings({ lookups }: { lookups: Lookups }) {
  const navigate = useNavigate();
  const columns: Column<Reservation>[] = [
    { key: 'guest', header: 'Guest', primary: true, render: (r) => <PersonCell name={guestName(lookups.guestById.get(r.guestId))} sub={r.code} /> },
    { key: 'stay', header: 'Stay', render: (r) => `${fmtDayMonth(r.checkIn)} to ${fmtDayMonth(r.checkOut)}` },
    { key: 'room', header: 'Room', render: (r) => (r.roomId ? lookups.roomById.get(r.roomId)?.number : lookups.categoryById.get(r.categoryId)?.code) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge> },
  ];
  return (
    <Panel title="Recent bookings" subtitle="The latest reservations across every channel." icon="calendar" actions={<Link className="btn btn-sm" to="/app/reservations">All reservations</Link>}>
      <DataTable
        caption="Most recently made bookings"
        columns={columns}
        rows={lookups.reservations.slice(0, 6)}
        rowKey={(r) => r.id}
        pageSize={6}
        onRowClick={(r) => navigate(`/app/reservations?open=${r.id}`)}
      />
    </Panel>
  );
}

function Board({ lookups }: { lookups: Lookups }) {
  const navigate = useNavigate();
  return (
    <Panel title="Room board" icon="grid" subtitle="The whole property at a glance. Select a room for its details.">
      <div className="panel-body">
        <RoomBoard rooms={lookups.rooms} categories={lookups.categories} onSelect={(room) => navigate(`/app/rooms?open=${room.id}`)} />
      </div>
    </Panel>
  );
}

/* ---------- Administrator & manager ---------- */

const REVENUE_VIEWS = [
  { key: 'total', label: 'Room + Food + Service', name: 'Revenue' },
  { key: 'room', label: 'Room only', name: 'Room revenue' },
  { key: 'food', label: 'Food only', name: 'Food revenue' },
  { key: 'service', label: 'Service only', name: 'Service revenue' },
] as const;

function RevenuePanel({ days }: { days: DayRevenue[] }) {
  const [viewKey, setViewKey] = useState<(typeof REVENUE_VIEWS)[number]['key']>('total');
  const view = REVENUE_VIEWS.find((v) => v.key === viewKey)!;
  return (
    <Panel
      title="Revenue, last 30 days"
      icon="activity"
      subtitle="Room, food and service income as earned, before tax."
      actions={
        <select className="input chart-filter" aria-label="Income shown in the revenue chart" value={viewKey} onChange={(e) => setViewKey(e.target.value as typeof viewKey)}>
          {REVENUE_VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>
      }
    >
      <div className="panel-body">
        <TrendArea
          data={days}
          xKey="date"
          series={{ key: view.key, name: view.name, color: SERIES[0] }}
          format={(v) => money(v)}
          axisFormat={moneyCompact}
          xFormat={fmtDayMonth}
          label={`Daily ${view.name.toLowerCase()} for the last 30 days, totalling ${money(days.reduce((sum, d) => sum + d[view.key], 0))}`}
        />
      </div>
    </Panel>
  );
}

function KpiPanel({ title, icon, art, children }: { title: string; icon: IconName; art: KpiArtKind; children: ReactNode }) {
  return (
    <section className="kpi-panel" aria-label={title}>
      <KpiPanelArt kind={art} />
      <h3 className="kpi-panel-title"><Icon name={icon} size={16} />{title}</h3>
      <div className="kpi-metrics">{children}</div>
    </section>
  );
}

function Metric({ label, value, note, to, testId, primary }: { label: string; value: ReactNode; note?: ReactNode; to: string; testId?: string; primary?: boolean }) {
  return (
    <Link to={to} className={`kpi-metric${primary ? ' is-primary' : ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" data-testid={testId}>{value}</span>
      {note && <span className="kpi-note">{note}</span>}
    </Link>
  );
}

function OwnerDashboard({ lookups }: { lookups: Lookups }) {
  const { data } = useResource(() => reportService.dashboard());
  if (!data) return <PageLoading />;
  const { snapshot: s, revenue30, occupancy14 } = data;
  const change = s.revenuePrevious30 ? ((s.revenue30 - s.revenuePrevious30) / s.revenuePrevious30) * 100 : 0;
  const now = today();

  return (
    <>
      <QuickActionCards lookups={lookups} />
      <section className="kpi-panels" aria-label="Key figures">
        <KpiPanel art="finance" title="Finance" icon="wallet">
          <Metric
            primary
            label="Revenue, last 30 days"
            value={moneyCompact(s.revenue30)}
            testId="kpi-revenue"
            to="/app/reports"
            note={
              <>
                <span className={`trend ${change >= 0 ? 'trend-up' : 'trend-down'}`}>
                  <Icon name={change >= 0 ? 'trendUp' : 'trendDown'} size={13} />
                  {change >= 0 ? '+' : '-'}{Math.abs(change).toFixed(1)}%
                </span>
                <span>vs previous 30 days</span>
              </>
            }
          />
          <Metric label="Average daily rate" value={money(Math.round(s.adr))} to="/app/reports" note={`RevPAR ${money(Math.round(s.revpar))}, last 30 days`} />
        </KpiPanel>
        <KpiPanel art="rooms" title="Rooms" icon="bed">
          <Metric label="Total rooms" value={s.totalRooms} testId="kpi-total-rooms" to="/app/rooms" note={`${s.maintenanceRooms} out of service`} />
          <Metric label="Available now" value={s.availableRooms} testId="kpi-available" to="/app/rooms" note={`Plus ${s.dirtyRooms} awaiting cleaning`} />
        </KpiPanel>
        <KpiPanel art="guests" title="Guests" icon="users">
          <Metric label="Check-ins today" value={s.arrivalsToday} testId="kpi-arrivals" to="/app/front-desk" note={`${s.arrivalsDone} completed`} />
          <Metric label="Check-outs today" value={s.departuresToday} testId="kpi-departures" to="/app/front-desk?tab=departures" note={`${s.departuresDone} completed`} />
        </KpiPanel>
        <KpiPanel art="property" title="Property" icon="building">
          <Metric label="Occupancy" value={percent(s.occupancyPercent)} testId="kpi-occupancy" to="/app/rooms" note={`${s.occupiedRooms} of ${s.totalRooms} rooms`} />
          <Metric label="Active reservations" value={s.activeReservations} testId="kpi-reservations" to="/app/reservations" note="In house or upcoming" />
        </KpiPanel>
      </section>

      <div className="grid-2-1">
        <RevenuePanel days={revenue30} />
        <Panel title="Rooms sold per night" icon="chart" subtitle="A week back and a week ahead, as a share of all rooms.">
          <div className="panel-body">
            <Bars
              data={occupancy14}
              xKey="date"
              series={[{ key: 'percent', name: 'Occupancy', color: SERIES[0] }]}
              format={(v) => percent(v)}
              axisFormat={(v) => `${v}%`}
              xFormat={fmtDayMonth}
              yMax={100}
              highlightX={now}
              label={`Occupancy per day. Today is ${percent(occupancy14.find((d) => d.date === now)?.percent ?? 0)}.`}
            />
          </div>
        </Panel>
      </div>

      <div className="grid-1-1 section-gap">
        <Board lookups={lookups} />
        <RecentBookings lookups={lookups} />
      </div>
    </>
  );
}

/* ---------- Front desk ---------- */

function DeskDashboard({ lookups }: { lookups: Lookups }) {
  const navigate = useNavigate();
  const now = today();
  const arrivals = lookups.reservations.filter((r) => r.checkIn === now && ['confirmed', 'pending'].includes(r.status));
  const departures = lookups.reservations.filter((r) => r.checkOut === now && r.status === 'checked_in');
  const inHouse = lookups.reservations.filter((r) => r.status === 'checked_in').length;
  const ready = lookups.rooms.filter((r) => r.status === 'vacant' && r.cleaning === 'clean').length;

  const list = (rows: Reservation[], empty: string) =>
    rows.length === 0 ? (
      <EmptyState icon="check" title="All done" message={empty} />
    ) : (
      <ul className="mini-list">
        {rows.slice(0, 6).map((r) => (
          <li key={r.id}>
            <span className="grow">
              <PersonCell
                name={guestName(lookups.guestById.get(r.guestId))}
                vip={lookups.guestById.get(r.guestId)?.vip}
                sub={r.roomId ? `Room ${lookups.roomById.get(r.roomId)?.number}` : `${lookups.categoryById.get(r.categoryId)?.name}, no room yet`}
              />
            </span>
            <Button size="sm" onClick={() => navigate(`/app/reservations?open=${r.id}`)}>Open</Button>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <StatGrid>
        <StatCard icon="login" label="Arrivals to check in" testId="kpi-arrivals" value={arrivals.length} note="Today" to="/app/front-desk" />
        <StatCard icon="logout" tone="info" label="Departures to check out" testId="kpi-departures" value={departures.length} note="Today" to="/app/front-desk?tab=departures" />
        <StatCard icon="users" tone="gold" label="Guests in house" value={inHouse} note="Rooms occupied" to="/app/front-desk?tab=inhouse" />
        <StatCard icon="key" tone="good" label="Rooms ready to sell" testId="kpi-available" value={ready} note="Vacant and clean" to="/app/rooms" />
      </StatGrid>
      <div className="grid-1-1">
        <Panel title="Arriving today" icon="login" subtitle={`${arrivals.length} still to check in`} actions={<Link className="btn btn-sm" to="/app/front-desk">Open front desk</Link>}>
          {list(arrivals, 'Every arrival has been checked in.')}
        </Panel>
        <Panel title="Leaving today" icon="logout" subtitle={`${departures.length} still to check out`} actions={<Link className="btn btn-sm" to="/app/front-desk?tab=departures">Departures</Link>}>
          {list(departures, 'Every departure has been checked out.')}
        </Panel>
      </div>
      <div className="grid-1-1 section-gap">
        <Board lookups={lookups} />
        <RecentBookings lookups={lookups} />
      </div>
    </>
  );
}

/* ---------- Housekeeping ---------- */

function HousekeepingDashboard({ lookups }: { lookups: Lookups }) {
  const { user } = useAuth();
  const { run } = useFeedback();
  const { data } = useResource(async () => {
    const [tasks, maintenance] = await Promise.all([housekeepingService.list(), maintenanceService.list()]);
    return { tasks, maintenance };
  });
  const now = today();
  const mine = useMemo(
    () => (data?.tasks ?? []).filter((t) => t.assigneeId === user?.staffId && t.date === now).sort((a, b) => a.time.localeCompare(b.time)),
    [data, user, now],
  );
  if (!data) return <PageLoading />;
  const open = mine.filter((t) => t.status !== 'done');
  const unassigned = data.tasks.filter((t) => !t.assigneeId && t.date === now && t.status !== 'done').length;
  const toClean = lookups.rooms.filter((r) => r.cleaning !== 'clean').length;
  const openMaintenance = data.maintenance.filter((m) => m.status !== 'resolved').length;

  return (
    <>
      <StatGrid>
        <StatCard icon="broom" tone="warn" label="Rooms to clean" testId="kpi-to-clean" value={toClean} note="Across the property" to="/app/housekeeping?tab=rooms" />
        <StatCard icon="tasks" label="My open tasks" testId="kpi-my-tasks" value={open.length} note={`${mine.length - open.length} done today`} meter={shareDone(mine.length - open.length, mine.length)} to="/app/housekeeping" />
        <StatCard icon="hourglass" tone="gold" label="Waiting for an owner" value={unassigned} note="Unassigned today" to="/app/housekeeping" />
        <StatCard icon="wrench" tone="bad" label="Maintenance open" value={openMaintenance} note="Requests in progress" to="/app/housekeeping?tab=maintenance" />
      </StatGrid>
      <div className="grid-1-1">
        <Panel title="My tasks today" icon="tasks" subtitle={`${mine.length - open.length} of ${mine.length} finished`} actions={<Link className="btn btn-sm" to="/app/housekeeping">Full schedule</Link>}>
          {mine.length > 0 && <div className="panel-body" style={{ paddingBottom: 4 }}><Meter value={shareDone(mine.length - open.length, mine.length)} /></div>}
          {open.length === 0 ? (
            <EmptyState icon="check" title="Your list is clear" message="Nothing else is assigned to you today." />
          ) : (
            <ul className="mini-list">
              {open.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <span className="grow">
                    <span className="cell-title">Room {lookups.roomById.get(t.roomId)?.number}</span>
                    <span className="cell-sub" style={{ display: 'block' }}>{TASK_TYPE[t.type]}{t.time ? ` · ${t.time}` : ''}</span>
                  </span>
                  {t.status === 'pending' ? (
                    <Button size="sm" onClick={() => run(() => housekeepingService.start(t.id), 'Task started')}>Start</Button>
                  ) : (
                    <Button size="sm" variant="primary" icon="check" onClick={() => run(() => housekeepingService.complete(t.id), 'Room marked clean')}>Done</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Board lookups={lookups} />
      </div>
    </>
  );
}

/* ---------- Page ---------- */

function OperationsHeading({ children }: { children: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      <p>The rest of the hotel, as it stands today.</p>
    </div>
  );
}

export default function Dashboard() {
  const { user, role, can } = useAuth();
  const { hotel } = useApp();
  const lookups = useLookups();
  if (!lookups || !role) return <PageLoading />;

  const firstName = user?.name.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const sales = can('customers.view');

  return (
    <>
      <PageHead
        title={<>{greeting}, <span className="page-accent">{firstName}</span></>}
        subtitle={<>{fmtWeekday(today())} · {hotel.name}, {role.name} view{sales ? ', leads and guest relationships' : ''}</>}
        actions={
          role.id === 'housekeeping' ? (
            <Link className="btn btn-primary" to="/app/housekeeping"><Icon name="broom" />Open schedule</Link>
          ) : (
            <>
              <Link className="btn" to="/app/front-desk"><Icon name="concierge" />Front desk</Link>
              <Link className="btn btn-primary" to="/app/front-desk?new=1"><Icon name="plus" />New booking</Link>
            </>
          )
        }
      />
      {sales && <LeadDashboard />}
      {role.id === 'housekeeping' ? (
        <HousekeepingDashboard lookups={lookups} />
      ) : (
        <>
          {sales && <OperationsHeading>Hotel operations</OperationsHeading>}
          {role.id === 'reception' ? <DeskDashboard lookups={lookups} /> : <OwnerDashboard lookups={lookups} />}
        </>
      )}
      <p className="small muted" style={{ marginTop: 18 }}>Sample data as of {fmtDate(today())}. All figures and leads are fictional; no Meta, booking-platform or messaging account is connected.</p>
    </>
  );
}
