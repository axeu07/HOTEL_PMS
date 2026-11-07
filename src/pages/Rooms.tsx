import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CLEANING_STATUS, RESERVATION_STATUS, ROOM_STATUS } from '@/app/labels';
import { useAuth } from '@/app/providers';
import { Art } from '@/components/art';
import { Icon } from '@/components/icons';
import { Badge, Button, DataTable, EmptyState, Modal, PageHead, PageLoading, Panel, SearchInput, SelectField, StatCard, StatGrid, Tabs, useFeedback, type Column } from '@/components/ui';
import { CategoryFormModal, RoomBoard, RoomFormModal } from '@/features/rooms';
import { useLookups, type Lookups } from '@/features/useLookups';
import { today } from '@/lib/dates';
import { fmtDate, money } from '@/lib/format';
import { guestName, roomService } from '@/services';
import type { CleaningStatus, Room, RoomCategory } from '@/types/domain';

function RoomDetail({ room, lookups, onClose }: { room: Room; lookups: Lookups; onClose: () => void }) {
  const { can } = useAuth();
  const { run, confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const category = lookups.categoryById.get(room.categoryId);
  const now = today();
  const stay = lookups.reservations.find((r) => r.roomId === room.id && r.status === 'checked_in');
  const upcoming = lookups.reservations
    .filter((r) => r.roomId === room.id && ['confirmed', 'pending'].includes(r.status) && r.checkOut >= now)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 4);
  const price = room.priceOverride ?? category?.basePrice ?? 0;
  const manage = can('rooms.manage');
  const canCleanStatus = can('rooms.status') || manage;

  return (
    <Modal
      title={`Room ${room.number}`}
      subtitle={`${category?.name} · floor ${room.floor}`}
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
                const ok = await confirm({ title: `Delete room ${room.number}?`, message: 'The room will be removed from inventory.', confirmLabel: 'Delete room', danger: true });
                if (ok && (await run(() => roomService.removeRoom(room.id), `Room ${room.number} deleted`))) onClose();
              }}
            >
              Delete
            </Button>
            {room.status === 'maintenance' ? (
              <Button onClick={() => run(() => roomService.setAvailability(room.id, 'vacant'), 'Room is back in service')}>Return to service</Button>
            ) : (
              <Button disabled={room.status === 'occupied'} icon="wrench" onClick={() => run(() => roomService.setAvailability(room.id, 'maintenance'), 'Room taken out of service')}>Take out of service</Button>
            )}
            <Button variant="primary" icon="edit" onClick={() => setEditing(true)}>Edit room</Button>
          </>
        ) : undefined
      }
    >
      <div className="stack">
        <div className="row">
          <Badge tone={ROOM_STATUS[room.status].tone}>{ROOM_STATUS[room.status].label}</Badge>
          <Badge tone={CLEANING_STATUS[room.cleaning].tone}>{CLEANING_STATUS[room.cleaning].label}</Badge>
        </div>
        <div className="grid-1-1">
          <dl className="dl">
            <dt>Tonight's price</dt><dd>{money(price)}{room.priceOverride !== null && ' (custom)'}</dd>
            <dt>Bed</dt><dd>{category?.bed}</dd>
            <dt>Size</dt><dd>{category?.sizeSqm} m²</dd>
            <dt>View</dt><dd>{category?.view}</dd>
            <dt>Sleeps</dt><dd>{category?.capacity}</dd>
            {room.notes && <><dt>Notes</dt><dd>{room.notes}</dd></>}
          </dl>
          <div>
            <div className="subhead">In room now</div>
            {stay ? (
              <p>
                {can('reservations.view') ? <Link to={`/app/reservations?open=${stay.id}`}>{guestName(lookups.guestById.get(stay.guestId))}</Link> : guestName(lookups.guestById.get(stay.guestId))}
                <span className="muted"> until {fmtDate(stay.checkOut)}</span>
              </p>
            ) : <p className="muted">No guest</p>}
            <div className="subhead" style={{ marginTop: 12 }}>Coming up</div>
            {upcoming.length === 0 && <p className="muted">Nothing booked</p>}
            {upcoming.map((r) => (
              <div key={r.id} className="small">
                {fmtDate(r.checkIn)} · {guestName(lookups.guestById.get(r.guestId))} <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge>
              </div>
            ))}
          </div>
        </div>
        {canCleanStatus && (
          <SelectField
            label="Cleaning status"
            value={room.cleaning}
            onChange={(e) => run(() => roomService.setCleaning(room.id, e.target.value as CleaningStatus), `Room ${room.number} updated`)}
          >
            {(Object.keys(CLEANING_STATUS) as CleaningStatus[]).map((c) => <option key={c} value={c}>{CLEANING_STATUS[c].label}</option>)}
          </SelectField>
        )}
        <div className="row">
          {can('reservations.manage') && room.status !== 'maintenance' && (
            <Link className="btn" to={`/app/reservations?new=1&room=${room.id}&category=${room.categoryId}`}><Icon name="plus" />Book a stay</Link>
          )}
          {can('housekeeping.view') && <Link className="btn" to="/app/housekeeping?tab=maintenance"><Icon name="wrench" />Report a problem</Link>}
        </div>
      </div>
      {editing && <RoomFormModal room={room} categories={lookups.categories} onClose={() => setEditing(false)} />}
    </Modal>
  );
}

export default function Rooms() {
  const lookups = useLookups();
  const { can } = useAuth();
  const { run, confirm } = useFeedback();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'rooms' | 'categories'>('rooms');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cleaning, setCleaning] = useState('');
  const [adding, setAdding] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<RoomCategory | 'new' | null>(null);
  const openId = params.get('open');

  const rooms = useMemo(() => {
    if (!lookups) return [];
    const q = query.trim().toLowerCase();
    return lookups.rooms.filter((r) => {
      if (status && r.status !== status) return false;
      if (categoryId && r.categoryId !== categoryId) return false;
      if (cleaning && r.cleaning !== cleaning) return false;
      if (q && !r.number.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lookups, query, status, categoryId, cleaning]);

  if (!lookups) return <PageLoading />;

  const openRoom = openId ? lookups.roomById.get(openId) : undefined;
  const count = (s: Room['status']) => lookups.rooms.filter((r) => r.status === s).length;
  const manage = can('rooms.manage');

  const columns: Column<Room>[] = [
    { key: 'number', header: 'Room', primary: true, sort: (r) => r.number, render: (r) => <span className="cell-title">{r.number}</span> },
    { key: 'category', header: 'Category', sort: (r) => lookups.categoryById.get(r.categoryId)?.name ?? '', render: (r) => lookups.categoryById.get(r.categoryId)?.name },
    { key: 'floor', header: 'Floor', sort: (r) => r.floor, hideOnMobile: true, render: (r) => r.floor },
    { key: 'status', header: 'Status', sort: (r) => r.status, render: (r) => <Badge tone={ROOM_STATUS[r.status].tone}>{ROOM_STATUS[r.status].label}</Badge> },
    { key: 'cleaning', header: 'Cleaning', sort: (r) => r.cleaning, render: (r) => <Badge tone={CLEANING_STATUS[r.cleaning].tone}>{CLEANING_STATUS[r.cleaning].label}</Badge> },
    { key: 'price', header: 'Price', num: true, sort: (r) => r.priceOverride ?? lookups.categoryById.get(r.categoryId)?.basePrice ?? 0, render: (r) => money(r.priceOverride ?? lookups.categoryById.get(r.categoryId)?.basePrice ?? 0) },
  ];

  return (
    <>
      <PageHead
        title="Rooms"
        subtitle={`${count('occupied')} occupied · ${count('vacant')} vacant · ${count('maintenance')} in maintenance`}
        actions={
          manage && (tab === 'rooms'
            ? <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add room</Button>
            : <Button variant="primary" icon="plus" onClick={() => setCategoryDialog('new')}>Add category</Button>)
        }
      />
      <StatGrid>
        <StatCard icon="key" tone="good" label="Occupied" value={count('occupied')} note={`of ${lookups.rooms.length} rooms`} meter={lookups.rooms.length ? (count('occupied') / lookups.rooms.length) * 100 : 0} />
        <StatCard icon="bed" label="Vacant" value={count('vacant')} note="Open for sale" />
        <StatCard icon="broom" tone="warn" label="Needs attention" value={lookups.rooms.filter((r) => r.cleaning !== 'clean').length} note="Dirty or being cleaned" />
        <StatCard icon="wrench" tone="bad" label="In maintenance" value={count('maintenance')} note="Out of service" />
      </StatGrid>
      <div style={{ marginBottom: 16 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'rooms', label: 'Room inventory', count: lookups.rooms.length },
            { id: 'categories', label: 'Categories & pricing', count: lookups.categories.length },
          ]}
        />
      </div>

      {tab === 'rooms' ? (
        <Panel>
          <div className="toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Room number" />
            <select className="input" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(ROOM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="input" aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" aria-label="Cleaning" value={cleaning} onChange={(e) => setCleaning(e.target.value)}>
              <option value="">Any cleaning state</option>
              {Object.entries(CLEANING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="segmented" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}><Icon name="grid" size={14} />Board</button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={14} />List</button>
            </div>
          </div>
          {rooms.length === 0 ? (
            <EmptyState icon="bed" title="No rooms match" message="Try another filter." />
          ) : view === 'board' ? (
            <div className="panel-body"><RoomBoard rooms={rooms} categories={lookups.categories} onSelect={(room) => setParams({ open: room.id })} /></div>
          ) : (
            <DataTable caption="Rooms" columns={columns} rows={rooms} rowKey={(r) => r.id} onRowClick={(r) => setParams({ open: r.id })} pageSize={15} />
          )}
        </Panel>
      ) : (
        <div className="category-grid">
          {lookups.categories.map((c) => {
            const inCategory = lookups.rooms.filter((r) => r.categoryId === c.id);
            return (
              <article key={c.id} className="category-card">
                <div className="category-art"><Art name={c.art} title={c.name} /></div>
                <div className="stack-sm">
                  <div className="row-between">
                    <h2 style={{ fontSize: 21 }}>{c.name}</h2>
                    <span className="category-price">{money(c.basePrice)}<span className="small muted"> / night</span></span>
                  </div>
                  <p className="small muted">{c.description}</p>
                  <div className="tag-list">
                    <span className="tag">{inCategory.length} rooms</span>
                    <span className="tag">{inCategory.filter((r) => r.status === 'vacant').length} vacant</span>
                    <span className="tag">Sleeps {c.capacity}</span>
                    <span className="tag">{c.sizeSqm} m²</span>
                    <span className="tag">{c.bed}</span>
                  </div>
                  {manage && (
                    <div className="row" style={{ marginTop: 'auto', paddingTop: 4 }}>
                      <Button size="sm" icon="edit" onClick={() => setCategoryDialog(c)}>Edit</Button>
                      <Button
                        size="sm"
                        icon="trash"
                        onClick={async () => {
                          const ok = await confirm({ title: `Delete ${c.name}?`, message: 'Only categories with no rooms or booking history can be deleted.', confirmLabel: 'Delete', danger: true });
                          if (ok) run(() => roomService.removeCategory(c.id), `${c.name} deleted`);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {adding && <RoomFormModal categories={lookups.categories} onClose={() => setAdding(false)} />}
      {categoryDialog && <CategoryFormModal category={categoryDialog === 'new' ? undefined : categoryDialog} onClose={() => setCategoryDialog(null)} />}
      {openRoom && <RoomDetail room={openRoom} lookups={lookups} onClose={() => setParams({})} />}
    </>
  );
}
