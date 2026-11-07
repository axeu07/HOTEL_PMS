import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RESERVATION_STATUS } from '@/app/labels';
import { useAuth } from '@/app/providers';
import { EmailLogo, WhatsAppLogo } from '@/components/brandIcons';
import { Icon, type IconName } from '@/components/icons';
import { Badge, Button, MiniStat, Modal, useFeedback } from '@/components/ui';
import { isOpenLead, LEAD_SOURCE, LEAD_STATUS, LEAD_STATUS_ORDER } from '@/domain/leads';
import { fmtDate, fmtDayMonth, money, timeAgo } from '@/lib/format';
import { leadService } from '@/services';
import type { Lead, LeadActivityKind, LeadStatus, MessageChannel } from '@/types/domain';
import { OutreachButtons } from './OutreachButtons';
import type { Crm } from './useCrm';

const KIND_ICON: Record<Exclude<LeadActivityKind, 'whatsapp' | 'email'>, IconName> = {
  created: 'userPlus',
  status: 'funnel',
  note: 'edit',
  call: 'phone',
  link: 'link',
  link_opened: 'external',
  booking: 'calendarCheck',
  follow_up: 'clock',
};

function ActivityIcon({ kind }: { kind: LeadActivityKind }) {
  if (kind === 'whatsapp') return <WhatsAppLogo size={22} />;
  if (kind === 'email') return <EmailLogo size={22} />;
  return <span className="act-icon"><Icon name={KIND_ICON[kind]} size={13} /></span>;
}

/** Where the lead is on the way to a booking, from what has actually been recorded. */
function Tracker({ lead, code }: { lead: Lead; code?: string }) {
  const contacted = lead.activity.some((a) => ['whatsapp', 'email', 'call'].includes(a.kind)) || lead.status !== 'new';
  const steps = [
    { label: 'Enquiry', done: true, note: fmtDayMonth(lead.enquiredAt.slice(0, 10)) },
    { label: 'Contacted', done: contacted },
    { label: 'Link sent', done: !!lead.linkCreatedAt, note: lead.linkCreatedAt ? fmtDayMonth(lead.linkCreatedAt.slice(0, 10)) : undefined },
    { label: 'Link opened', done: !!lead.linkOpenedAt, note: lead.linkOpenedAt ? fmtDayMonth(lead.linkOpenedAt.slice(0, 10)) : undefined },
    { label: 'Booked', done: !!lead.reservationId, note: code },
  ];
  return (
    <ol className="tracker" aria-label="Conversion progress">
      {steps.map((s) => (
        <li key={s.label} data-done={s.done || undefined}>
          <span className="tracker-dot">{s.done && <Icon name="check" size={11} />}</span>
          <span className="tracker-label">{s.label}</span>
          {s.note && <span className="tracker-note">{s.note}</span>}
        </li>
      ))}
    </ol>
  );
}

export function LeadDetail({
  leadId,
  crm,
  onClose,
  onContact,
  onLink,
  onBook,
  onEdit,
}: {
  leadId: string;
  crm: Crm;
  onClose: () => void;
  onContact: (lead: Lead, channel: MessageChannel) => void;
  onLink: (lead: Lead) => void;
  onBook: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
}) {
  const { user, can } = useAuth();
  const { run } = useFeedback();
  const lead = crm.leads.find((l) => l.id === leadId);
  const [panel, setPanel] = useState<null | 'follow_up' | 'lost'>(null);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const by = user?.name ?? 'Staff';
  const manage = can('customers.manage');

  if (!lead) {
    return (
      <Modal title="Lead not found" size="sm" onClose={onClose}>
        <p className="muted">This lead is no longer in the demo data.</p>
      </Modal>
    );
  }

  const reservation = lead.reservationId ? crm.reservationById.get(lead.reservationId) : undefined;
  const category = crm.categoryById.get(lead.categoryId);
  const open = isOpenLead(lead.status);
  const revenue = crm.revenueOf(lead);
  const assignee = lead.assignedTo ? crm.staffById.get(lead.assignedTo) : undefined;
  const overdue = !!lead.followUpOn && lead.followUpOn <= crm.now && open;

  const pick = (status: LeadStatus) => {
    if (status === 'follow_up') return setPanel('follow_up');
    if (status === 'lost') return setPanel('lost');
    setPanel(null);
    void run(() => leadService.setStatus(lead.id, status, by));
  };

  return (
    <Modal
      title={lead.name}
      subtitle={`${LEAD_SOURCE[lead.source].label} · ${lead.sourceDetail}`}
      size="xl"
      onClose={onClose}
      footer={
        manage ? (
          <>
            <Button icon="edit" onClick={() => onEdit(lead)}>Edit</Button>
            {open && <Button icon="link" onClick={() => onLink(lead)}>Generate booking link</Button>}
            {open && <Button variant="primary" icon="calendarCheck" onClick={() => onBook(lead)}>Create booking</Button>}
          </>
        ) : undefined
      }
    >
      <div className="lead-grid">
        <div className="stack">
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <Badge tone={LEAD_STATUS[lead.status].tone}>{LEAD_STATUS[lead.status].label}</Badge>
            {overdue && <Badge tone="warn">{lead.followUpOn < crm.now ? 'Follow-up overdue' : 'Follow-up today'}</Badge>}
            {manage && open && <OutreachButtons name={lead.name} size="md" onPick={(c) => onContact(lead, c)} />}
          </div>

          <Tracker lead={lead} code={reservation?.code} />

          {reservation && (
            <div className="alert alert-good">
              <Icon name="check" />
              <span>
                Converted into booking <Link to={`/app/reservations?open=${reservation.id}`} className="strong">{reservation.code}</Link>{' '}
                <Badge tone={RESERVATION_STATUS[reservation.status].tone}>{RESERVATION_STATUS[reservation.status].label}</Badge>
                {revenue > 0 && <> · {money(revenue)} billed</>}
              </span>
            </div>
          )}
          {lead.status === 'lost' && lead.lostReason && <div className="alert alert-bad"><Icon name="info" /><span>Lost: {lead.lostReason}</span></div>}

          <div className="mini-stats">
            <MiniStat label="Enquired" value={fmtDayMonth(lead.enquiredAt.slice(0, 10))} />
            <MiniStat label="Budget / night" value={lead.budget ? money(lead.budget) : '–'} />
            <MiniStat label="Guests" value={lead.adults} />
          </div>

          <dl className="dl">
            <dt>Phone</dt><dd>{lead.phone || '–'}</dd>
            <dt>Email</dt><dd>{lead.email || '–'}</dd>
            <dt>Preferred dates</dt><dd>{lead.checkIn && lead.checkOut ? `${fmtDate(lead.checkIn)} to ${fmtDate(lead.checkOut)}` : 'Not given'}</dd>
            <dt>Room</dt><dd>{category?.name ?? 'Not decided'}</dd>
            <dt>Assigned to</dt>
            <dd>
              {manage ? (
                <select
                  className="input assign-select"
                  aria-label="Assigned to"
                  value={lead.assignedTo}
                  onChange={(e) => {
                    const id = e.target.value;
                    void run(() => leadService.assign(lead.id, id, crm.staffById.get(id)?.name ?? '', by));
                  }}
                >
                  <option value="">Unassigned</option>
                  {crm.staff.filter((s) => s.active && s.department !== 'Housekeeping').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (assignee?.name ?? 'Unassigned')}
            </dd>
            <dt>Follow-up</dt><dd>{lead.followUpOn ? fmtDate(lead.followUpOn) : 'None set'}</dd>
          </dl>
          {lead.notes && <div className="alert alert-info"><Icon name="info" /><span>{lead.notes}</span></div>}

          {manage && (
            <div className="stack-sm">
              <span className="field-label">Move to</span>
              <div className="status-chips" role="group" aria-label="Lead status">
                {LEAD_STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="status-chip"
                    aria-pressed={lead.status === s}
                    disabled={s === 'converted'}
                    title={s === 'converted' ? 'A lead is Converted when a booking is made for it' : undefined}
                    onClick={() => pick(s)}
                  >
                    {LEAD_STATUS[s].label}
                  </button>
                ))}
              </div>
              {panel === 'follow_up' && (
                <div className="inline-form">
                  <input type="date" className="input" aria-label="Follow-up date" min={crm.now} value={date} onChange={(e) => setDate(e.target.value)} />
                  <Button variant="primary" size="sm" onClick={async () => { if (await run(() => leadService.setStatus(lead.id, 'follow_up', by, { followUpOn: date }), 'Follow-up set')) { setPanel(null); setDate(''); } }}>Set follow-up</Button>
                  <Button size="sm" onClick={() => setPanel(null)}>Cancel</Button>
                </div>
              )}
              {panel === 'lost' && (
                <div className="inline-form">
                  <select className="input" aria-label="Reason lost" value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value="">Why was it lost?</option>
                    {['Booked elsewhere', 'Price too high for the budget', 'Dates no longer available', 'Plans changed', 'No response after follow-ups'].map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <Button variant="danger" size="sm" onClick={async () => { if (await run(() => leadService.setStatus(lead.id, 'lost', by, { lostReason: reason }), 'Lead marked as lost')) { setPanel(null); setReason(''); } }}>Mark lost</Button>
                  <Button size="sm" onClick={() => setPanel(null)}>Cancel</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stack">
          <h3 className="contact-h">Activity</h3>
          {manage && (
            <div className="note-box">
              <textarea className="input" rows={2} placeholder="Write a note, or what was said on a call…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="New note" />
              <div className="row">
                <Button size="sm" icon="phone" disabled={!note.trim()} onClick={async () => { if (await run(() => leadService.addNote(lead.id, 'call', note, by), 'Call logged')) setNote(''); }}>Log as call</Button>
                <Button size="sm" variant="primary" icon="edit" disabled={!note.trim()} onClick={async () => { if (await run(() => leadService.addNote(lead.id, 'note', note, by), 'Note added')) setNote(''); }}>Add note</Button>
              </div>
            </div>
          )}
          <ol className="activity-list">
            {[...lead.activity].sort((a, b) => b.at.localeCompare(a.at)).map((a) => (
              <li key={a.id}>
                <ActivityIcon kind={a.kind} />
                <span className="grow">
                  <span className="act-text">{a.text}</span>
                  <span className="cell-sub" style={{ display: 'block' }}>{a.by} · {timeAgo(a.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  );
}
