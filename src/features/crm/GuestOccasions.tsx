import { useMemo, useState, type FormEvent } from 'react';
import { RESERVATION_STATUS } from '@/app/labels';
import { Icon } from '@/components/icons';
import { Badge, Button, DataTable, EmptyState, Modal, SelectField, useFeedback, type Column } from '@/components/ui';
import {
  draftFromOccasion,
  OCCASION_CATEGORIES,
  OCCASION_ICON,
  OCCASION_LABEL,
  OCCASION_PLURAL,
  summariseOccasions,
  type OccasionDraft,
  type OccasionRow,
} from '@/domain/occasions';
import { fmtDate, fmtDayMonth } from '@/lib/format';
import { errorMessage } from '@/lib/validation';
import { guestName, occasionService } from '@/services';
import type { GuestOccasion, OccasionType, Reservation } from '@/types/domain';
import { OccasionFields } from '../occasions';
import type { Crm } from './useCrm';

type When = 'all' | 'upcoming' | 'past';

/* ---------- The dashboard row ---------- */

export function GuestOccasionsRow({ rows, onOpen, active }: { rows: OccasionRow[]; onOpen: (type: OccasionType | '') => void; active?: OccasionType | '' }) {
  const summary = useMemo(() => summariseOccasions(rows), [rows]);
  return (
    <section className="tier-dist occasion-dist" aria-label="Guest occasions">
      <span className="tier-dist-title">Guest occasions</span>
      <div className="tier-dist-row occasion-row">
        {summary.map((s) => (
          <button key={s.type} type="button" className="tier-dist-item occasion-item" aria-pressed={active === s.type} data-occasion={s.type} data-testid={`occasion-${s.type}`} onClick={() => onOpen(s.type)}>
            <span className="occasion-icon"><Icon name={OCCASION_ICON[s.type]} size={15} /></span>
            <span className="occasion-text">
              <span className="tier-label">{OCCASION_PLURAL[s.type]}</span>
              <span className="occasion-figures">
                <span className="tier-count">{s.total}</span>
                <span className="tier-rule">{s.upcoming ? `${s.upcoming} upcoming${s.nextOn ? ` · next ${fmtDayMonth(s.nextOn)}` : ''}` : s.total ? 'None upcoming' : 'None yet'}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- Filtered guest list ---------- */

export function OccasionList({ rows, type, onTypeChange, onOpenGuest }: { rows: OccasionRow[]; type: OccasionType | ''; onTypeChange: (t: OccasionType | '') => void; onOpenGuest: (guestId: string) => void }) {
  const [when, setWhen] = useState<When>('all');

  const shown = useMemo(() => rows.filter((r) => {
    if (!OCCASION_CATEGORIES.includes(r.occasion.type)) return false;
    if (type && r.occasion.type !== type) return false;
    if (when === 'upcoming' && !r.upcoming) return false;
    if (when === 'past' && r.upcoming) return false;
    return true;
  }), [rows, type, when]);

  const stayCell = (r: OccasionRow) => {
    const stay = r.nextStay ?? r.reservation;
    if (!stay) return <span className="cell-sub">No booking</span>;
    return (
      <span>
        <Badge tone={RESERVATION_STATUS[stay.status].tone}>{RESERVATION_STATUS[stay.status].label}</Badge>
        <span className="cell-sub" style={{ display: 'block' }}>{stay.code} · {fmtDate(stay.checkIn)}</span>
      </span>
    );
  };

  const columns: Column<OccasionRow>[] = [
    { key: 'guest', header: 'Guest', primary: true, sort: (r) => r.guest.lastName, render: (r) => <span className="strong">{guestName(r.guest)}</span> },
    { key: 'phone', header: 'Phone', hideOnMobile: true, render: (r) => r.guest.phone || '–' },
    {
      key: 'type',
      header: 'Occasion',
      sort: (r) => r.occasion.type,
      render: (r) => (
        <span className="occasion-chip" data-occasion={r.occasion.type}>
          <Icon name={OCCASION_ICON[r.occasion.type]} size={14} />
          <span>{OCCASION_LABEL[r.occasion.type]}{r.occasion.celebrant ? <span className="cell-sub" style={{ display: 'block' }}>{r.occasion.celebrant}</span> : null}</span>
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Occasion date',
      sort: (r) => r.occursOn ?? '9999',
      render: (r) => (r.occursOn ? <span>{fmtDate(r.occursOn)}{!r.occasion.date && <span className="cell-sub" style={{ display: 'block' }}>Arrival date</span>}</span> : '–'),
    },
    { key: 'stay', header: 'Upcoming stay / booking', render: stayCell },
    { key: 'last', header: 'Last visit', hideOnMobile: true, sort: (r) => r.lastVisit ?? '', render: (r) => (r.lastVisit ? fmtDate(r.lastVisit) : '–') },
  ];

  return (
    <div data-testid="occasion-list">
      <div className="stack">
        <div className="toolbar" style={{ padding: 0 }}>
          <div className="segmented" role="group" aria-label="When">
            {(['all', 'upcoming', 'past'] as const).map((w) => (
              <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)}>{w === 'all' ? 'All occasions' : w === 'upcoming' ? 'Upcoming' : 'Past'}</button>
            ))}
          </div>
          <select className="input" aria-label="Occasion type" value={type} onChange={(e) => onTypeChange(e.target.value as OccasionType | '')}>
            <option value="">All types</option>
            {OCCASION_CATEGORIES.map((t) => <option key={t} value={t}>{OCCASION_PLURAL[t]}</option>)}
          </select>
        </div>
        <DataTable
          caption="Guest occasions"
          columns={columns}
          rows={shown}
          rowKey={(r) => r.occasion.id}
          pageSize={8}
          defaultSort={{ key: 'date', dir: when === 'past' ? 'desc' : 'asc' }}
          onRowClick={(r) => onOpenGuest(r.guest.id)}
          empty={<EmptyState icon="calendar" title="No occasions match" message="Occasions appear here when guests mention them at booking or check-in." />}
        />
      </div>
    </div>
  );
}

/* ---------- On a guest's profile ---------- */

const SOURCE_LABEL = { booking: 'Booking', check_in: 'Check-in', profile: 'Added by staff' } as const;

export function ProfileOccasions({ guestId, crm, canEdit }: { guestId: string; crm: Crm; canEdit: boolean }) {
  const { toast } = useFeedback();
  const mine = crm.occasions.filter((o) => o.guestId === guestId).sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
  const bookings = crm.reservations.filter((r) => r.guestId === guestId && !['cancelled', 'no_show'].includes(r.status)).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const [editing, setEditing] = useState<GuestOccasion | 'new' | null>(null);

  const remove = async (o: GuestOccasion) => {
    await occasionService.remove(o.id);
    toast('Occasion removed');
  };

  return (
    <div>
      <div className="row-between">
        <h3 className="contact-h">Occasions</h3>
        {canEdit && <Button size="sm" icon="plus" onClick={() => setEditing('new')}>Add</Button>}
      </div>
      {mine.length === 0 ? (
        <p className="muted small">No occasions recorded for this guest.</p>
      ) : (
        <ul className="mini-list list-box" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {mine.map((o) => {
            const res = o.reservationId ? crm.reservationById.get(o.reservationId) : undefined;
            return (
              <li key={o.id} style={{ padding: '8px 12px' }}>
                <span className="occasion-chip" data-occasion={o.type}><Icon name={OCCASION_ICON[o.type]} size={14} /></span>
                <span className="grow">
                  <span className="strong">{OCCASION_LABEL[o.type]}{o.celebrant ? ` · ${o.celebrant}` : ''}</span>
                  <span className="cell-sub" style={{ display: 'block' }}>
                    {o.date ? fmtDate(o.date) : 'No date given'}{res ? ` · ${res.code}` : ''} · {SOURCE_LABEL[o.source]}
                  </span>
                  {o.notes && <span className="cell-sub" style={{ display: 'block' }}>{o.notes}</span>}
                </span>
                {canEdit && (
                  <span className="row">
                    <button type="button" className="icon-btn" aria-label={`Edit ${OCCASION_LABEL[o.type]}`} onClick={() => setEditing(o)}><Icon name="edit" /></button>
                    <button type="button" className="icon-btn" aria-label={`Remove ${OCCASION_LABEL[o.type]}`} onClick={() => remove(o)}><Icon name="trash" /></button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="small muted" style={{ marginTop: 6 }}>Stay occasions are separate from the guest’s own birthday above.</p>
      {editing && <OccasionEditor guestId={guestId} occasion={editing === 'new' ? undefined : editing} bookings={bookings} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OccasionEditor({ guestId, occasion, bookings, onClose }: { guestId: string; occasion?: GuestOccasion; bookings: Reservation[]; onClose: () => void }) {
  const { toast } = useFeedback();
  const [draft, setDraft] = useState<OccasionDraft>(draftFromOccasion(occasion));
  const [reservationId, setReservationId] = useState(occasion?.reservationId ?? '');
  const [failure, setFailure] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.type || draft.type === 'none') return setFailure('Choose an occasion.');
    try {
      const input = { reservationId: reservationId || null, type: draft.type, date: draft.date, celebrant: draft.celebrant, notes: draft.notes };
      if (occasion) await occasionService.update(occasion.id, input);
      else await occasionService.add({ guestId, ...input });
      toast(occasion ? 'Occasion updated' : 'Occasion added');
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      title={occasion ? 'Edit occasion' : 'Add an occasion'}
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="occasion-form">Save</Button></>}
    >
      <form id="occasion-form" className="form-grid" onSubmit={submit} noValidate>
        <OccasionFields draft={draft} onChange={setDraft} label="Occasion" idPrefix="profile-occasion" />
        <SelectField label="Booking (optional)" wrapClass="full" value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
          <option value="">Not tied to a booking</option>
          {bookings.map((b) => <option key={b.id} value={b.id}>{b.code} · {fmtDate(b.checkIn)} to {fmtDate(b.checkOut)}</option>)}
        </SelectField>
        {failure && <div className="alert alert-bad full"><Icon name="alert" /><span>{failure}</span></div>}
      </form>
    </Modal>
  );
}
