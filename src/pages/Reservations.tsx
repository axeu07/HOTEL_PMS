import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RESERVATION_STATUS, SOURCE_LABEL } from '@/app/labels';
import { useAuth } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Badge, Button, DataTable, EmptyState, PageHead, PageLoading, Panel, PersonCell, SearchInput, StatCard, StatGrid, type Column } from '@/components/ui';
import { ReservationDetailModal, ReservationFormModal } from '@/features/reservations';
import { useLookups, type Lookups } from '@/features/useLookups';
import { addDays, nightsBetween, parseDate, rangeDays, today } from '@/lib/dates';
import { fmtDate, money } from '@/lib/format';
import { guestName } from '@/services';
import type { BookingSource, Reservation, ReservationStatus, Room } from '@/types/domain';

const STATUSES = Object.keys(RESERVATION_STATUS) as ReservationStatus[];
const SOURCES = Object.keys(SOURCE_LABEL) as BookingSource[];

/* ---------- Timeline (tape chart) ---------- */

const DAYS = 14;

function Timeline({
  lookups,
  onOpen,
  onBook,
}: {
  lookups: Lookups;
  onOpen: (id: string) => void;
  onBook: (room: Room, date: string) => void;
}) {
  const [start, setStart] = useState(addDays(today(), -2));
  const [categoryId, setCategoryId] = useState('');
  const days = rangeDays(start, addDays(start, DAYS - 1));
  const end = addDays(start, DAYS);
  const now = today();
  const rooms = lookups.rooms.filter((r) => !categoryId || r.categoryId === categoryId);
  const { can } = useAuth();

  const stays = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of lookups.reservations) {
      if (!r.roomId || r.checkOut <= start || r.checkIn >= end) continue;
      if (['cancelled', 'no_show'].includes(r.status)) continue;
      map.set(r.roomId, [...(map.get(r.roomId) ?? []), r]);
    }
    return map;
  }, [lookups.reservations, start, end]);

  return (
    <>
      <div className="toolbar">
        <Button size="sm" icon="prev" aria-label="Earlier" onClick={() => setStart(addDays(start, -7))} />
        <Button size="sm" onClick={() => setStart(addDays(now, -2))}>Today</Button>
        <Button size="sm" icon="next" aria-label="Later" onClick={() => setStart(addDays(start, 7))} />
        <select className="input" aria-label="Filter by category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="small muted grow">Select a stay to open it{can('reservations.manage') ? ', or an empty day to start a booking' : ''}.</span>
      </div>
      <div className="timeline-scroll" tabIndex={0} aria-label="Room timeline">
        <div
          className="timeline"
          data-testid="timeline"
          style={{ gridTemplateColumns: `104px repeat(${DAYS}, 66px)`, gridAutoRows: 'minmax(40px, auto)' }}
        >
          <div className="tl-head tl-corner" style={{ gridColumn: 1, gridRow: 1 }}>Room</div>
          {days.map((d, i) => (
            <div key={d} className={`tl-head ${d === now ? 'today' : ''}`} style={{ gridColumn: i + 2, gridRow: 1 }}>
              {parseDate(d).toLocaleDateString('en-GB', { weekday: 'short' })}
              <b>{parseDate(d).getDate()}</b>
            </div>
          ))}
          {rooms.map((room, rowIndex) => {
            const row = rowIndex + 2;
            return [
              <div key={`l${room.id}`} className="tl-room" style={{ gridColumn: 1, gridRow: row }}>
                <b>{room.number}</b>
                <span>{lookups.categoryById.get(room.categoryId)?.code}{room.status === 'maintenance' ? ' · out of service' : ''}</span>
              </div>,
              ...days.map((d, i) => (
                <div
                  key={`${room.id}${d}`}
                  className={`tl-cell ${d === now ? 'today' : ''}`}
                  style={{ gridColumn: i + 2, gridRow: row, cursor: can('reservations.manage') ? 'cell' : undefined }}
                  onClick={can('reservations.manage') && d >= now ? () => onBook(room, d) : undefined}
                />
              )),
              ...(stays.get(room.id) ?? []).map((r) => {
                const from = Math.max(0, nightsBetween(start, r.checkIn));
                const to = Math.min(DAYS, nightsBetween(start, r.checkOut));
                if (to <= from) return null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`tl-bar tl-${r.status}`}
                    style={{ gridColumn: `${from + 2} / ${to + 2}`, gridRow: row }}
                    title={`${guestName(lookups.guestById.get(r.guestId))}, ${fmtDate(r.checkIn)} to ${fmtDate(r.checkOut)}`}
                    onClick={() => onOpen(r.id)}
                  >
                    {guestName(lookups.guestById.get(r.guestId))}
                  </button>
                );
              }),
            ];
          })}
        </div>
      </div>
      <div className="table-foot">
        <div className="legend">
          {(['checked_in', 'confirmed', 'pending', 'checked_out'] as ReservationStatus[]).map((s) => (
            <span key={s}><i className={`chart-swatch tl-${s}`} />{RESERVATION_STATUS[s].label}</span>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Page ---------- */

export default function Reservations() {
  const lookups = useLookups();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'list' | 'timeline'>('list');
  const [query, setQuery] = useState('');
  const status = params.get('status') ?? '';
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [creating, setCreating] = useState<null | { roomId?: string; categoryId?: string; checkIn?: string; checkOut?: string; guestId?: string }>(null);
  const openId = params.get('open');

  const updateParam = (key: string, value: string | null) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  };

  // Deep link from dashboards and guest profiles: /app/reservations?new=1
  useEffect(() => {
    if (params.get('new') && can('reservations.manage')) {
      setCreating({
        guestId: params.get('guest') ?? undefined,
        roomId: params.get('room') ?? undefined,
        categoryId: params.get('category') ?? undefined,
      });
      setParams((current) => {
        const next = new URLSearchParams(current);
        ['new', 'guest', 'room', 'category'].forEach((key) => next.delete(key));
        return next;
      }, { replace: true });
    }
  }, [params, setParams, can]);

  const rows = useMemo(() => {
    if (!lookups) return [];
    const q = query.trim().toLowerCase();
    return lookups.reservations.filter((r) => {
      if (status && r.status !== status) return false;
      if (source && r.source !== source) return false;
      if (from && r.checkIn < from) return false;
      if (to && r.checkIn > to) return false;
      if (q) {
        const g = lookups.guestById.get(r.guestId);
        const hay = `${guestName(g)} ${g?.phone} ${r.code} ${r.roomId ? lookups.roomById.get(r.roomId)?.number : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lookups, query, status, source, from, to]);

  if (!lookups) return <PageLoading />;

  const columns: Column<Reservation>[] = [
    {
      key: 'guest',
      header: 'Guest',
      primary: true,
      sort: (r) => guestName(lookups.guestById.get(r.guestId)),
      render: (r) => (
        <PersonCell name={guestName(lookups.guestById.get(r.guestId))} vip={lookups.guestById.get(r.guestId)?.vip} sub={r.code} />
      ),
    },
    { key: 'in', header: 'Check-in', sort: (r) => r.checkIn, render: (r) => <span className="nowrap">{fmtDate(r.checkIn)}</span> },
    { key: 'out', header: 'Check-out', sort: (r) => r.checkOut, render: (r) => <span className="nowrap">{fmtDate(r.checkOut)}</span> },
    {
      key: 'room',
      header: 'Room',
      sort: (r) => (r.roomId ? lookups.roomById.get(r.roomId)?.number ?? '' : ''),
      render: (r) => (
        <>
          <div className="strong">{r.roomId ? lookups.roomById.get(r.roomId)?.number : <span className="muted">Unassigned</span>}</div>
          <div className="cell-sub">{lookups.categoryById.get(r.categoryId)?.name}</div>
        </>
      ),
    },
    { key: 'source', header: 'Source', hideOnMobile: true, render: (r) => SOURCE_LABEL[r.source] },
    { key: 'rate', header: 'Rate', num: true, hideOnMobile: true, sort: (r) => r.ratePerNight, render: (r) => money(r.ratePerNight) },
    { key: 'status', header: 'Status', sort: (r) => r.status, render: (r) => <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge> },
  ];

  const hasFilter = !!(query || status || source || from || to);
  const countOf = (s: ReservationStatus) => lookups.reservations.filter((r) => r.status === s).length;
  const statusLink = (s: ReservationStatus) => `/app/reservations?status=${s}`;

  return (
    <>
      <PageHead
        title="Reservations"
        subtitle="Every booking, past and upcoming."
        actions={
          <>
            <div className="segmented" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={14} />List</button>
              <button type="button" aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}><Icon name="timeline" size={14} />Timeline</button>
            </div>
            {can('reservations.manage') && <Button variant="primary" icon="plus" onClick={() => setCreating({})}>New booking</Button>}
          </>
        }
      />
      <StatGrid>
        <StatCard icon="hourglass" tone="warn" label="Pending" value={countOf('pending')} note="Waiting to be confirmed" to={statusLink('pending')} />
        <StatCard icon="calendarCheck" tone="info" label="Confirmed" value={countOf('confirmed')} note="Upcoming stays" to={statusLink('confirmed')} />
        <StatCard icon="key" tone="good" label="In house" value={countOf('checked_in')} note="Currently staying" to={statusLink('checked_in')} />
        <StatCard icon="ban" tone="bad" label="Cancelled" value={countOf('cancelled')} note="Released rooms" to={statusLink('cancelled')} />
      </StatGrid>
      <Panel>
        {view === 'timeline' ? (
          <Timeline
            lookups={lookups}
            onOpen={(id) => updateParam('open', id)}
            onBook={(room, date) => setCreating({ roomId: room.id, categoryId: room.categoryId, checkIn: date, checkOut: addDays(date, 2) })}
          />
        ) : (
          <>
            <div className="toolbar">
              <SearchInput value={query} onChange={setQuery} placeholder="Guest, phone, booking or room" />
              <select className="input" aria-label="Status" value={status} onChange={(e) => updateParam('status', e.target.value || null)}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{RESERVATION_STATUS[s].label}</option>)}
              </select>
              <select className="input" aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">All sources</option>
                {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
              </select>
              <label className="row small muted" style={{ gap: 5 }}>From <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="row small muted" style={{ gap: 5 }}>To <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
              {hasFilter && (
                <Button size="sm" variant="ghost" onClick={() => { setQuery(''); updateParam('status', null); setSource(''); setFrom(''); setTo(''); }}>Clear</Button>
              )}
            </div>
            <DataTable
              caption="Reservations"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={(r) => updateParam('open', r.id)}
              empty={
                <EmptyState
                  icon="calendar"
                  title={hasFilter ? 'No bookings match' : 'No bookings yet'}
                  message={hasFilter ? 'Try widening your filters.' : 'New bookings will appear here.'}
                />
              }
            />
          </>
        )}
      </Panel>

      {creating && (
        <ReservationFormModal
          lookups={lookups}
          defaults={creating}
          onClose={() => setCreating(null)}
          onSaved={(r) => updateParam('open', r.id)}
        />
      )}
      {openId && <ReservationDetailModal reservationId={openId} lookups={lookups} onClose={() => updateParam('open', null)} />}
    </>
  );
}
