import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers';
import { EmailLogo, WhatsAppLogo } from '@/components/brandIcons';
import { Icon } from '@/components/icons';
import { Badge, Button, DataTable, EmptyState, PageHead, PageLoading, Panel, PersonCell, SearchInput, StatCard, StatGrid, Tabs, useFeedback, type Column } from '@/components/ui';
import { isOpenLead, LEAD_SOURCE, LEAD_SOURCE_ORDER, LEAD_STATUS, LEAD_STATUS_ORDER } from '@/domain/leads';
import { samePhone } from '@/lib/phone';
import { BookingLinkModal } from '@/features/crm/BookingLinkModal';
import { ContactModal } from '@/features/crm/ContactModal';
import { leadRecipient } from '@/features/crm/recipients';
import { LeadDetail } from '@/features/crm/LeadDetail';
import { LeadForm } from '@/features/crm/LeadForm';
import { OutreachButtons } from '@/features/crm/OutreachButtons';
import { useCrm } from '@/features/crm/useCrm';
import { ReservationFormModal } from '@/features/reservations';
import { useLookups } from '@/features/useLookups';
import { fmtDate, fmtDayMonth, money, percent } from '@/lib/format';
import { emptyGuest, guestService, leadService } from '@/services';
import type { Lead, MessageChannel } from '@/types/domain';

type StatusTab = 'all' | Lead['status'];

export default function Leads() {
  const crm = useCrm();
  const lookups = useLookups();
  const { can, user } = useAuth();
  const { toast, toastError } = useFeedback();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusTab>((params.get('status') as StatusTab) || 'all');
  const [source, setSource] = useState('');
  const [assignee, setAssignee] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dueOnly, setDueOnly] = useState(params.get('due') === '1');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [linkFor, setLinkFor] = useState<Lead | null>(null);
  const [contact, setContact] = useState<{ ids: string[]; channel: MessageChannel; template?: string; title: string } | null>(null);
  const [booking, setBooking] = useState<{ lead: Lead; guestId: string } | null>(null);
  const manage = can('customers.manage');
  const openId = params.get('open');

  // The dashboard's quick actions arrive here with ?new=1.
  useEffect(() => {
    if (params.get('new') === '1' && manage) {
      setAdding(true);
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, manage, setParams]);

  const rows = useMemo(() => {
    if (!crm) return [];
    const q = query.trim().toLowerCase();
    return crm.leads.filter((l) => {
      if (status !== 'all' && l.status !== status) return false;
      if (source && l.source !== source) return false;
      if (assignee === 'none' ? l.assignedTo : assignee && l.assignedTo !== assignee) return false;
      const day = l.enquiredAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (dueOnly && !(l.followUpOn && l.followUpOn <= crm.now && isOpenLead(l.status))) return false;
      return !q || `${l.name} ${l.phone} ${l.email} ${l.sourceDetail}`.toLowerCase().includes(q);
    });
  }, [crm, query, status, source, assignee, from, to, dueOnly]);

  if (!crm || !lookups) return <PageLoading />;

  const counts = (s: StatusTab) => (s === 'all' ? crm.leads.length : crm.leads.filter((l) => l.status === s).length);
  const today = crm.now;
  const newToday = crm.leads.filter((l) => l.enquiredAt.slice(0, 10) === today).length;
  const dueCount = crm.leads.filter((l) => l.followUpOn && l.followUpOn <= today && isOpenLead(l.status)).length;
  const converted = counts('converted');
  const rate = crm.leads.length ? (converted / crm.leads.length) * 100 : 0;

  const byId = new Map(crm.leads.map((l) => [l.id, l]));
  const open = openId ? byId.get(openId) : undefined;
  const shownSelected = rows.filter((l) => selected.has(l.id));
  const allShown = rows.length > 0 && shownSelected.length === rows.length;
  const by = user?.name ?? 'Staff';

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); rows.forEach((l) => (allShown ? n.delete(l.id) : n.add(l.id))); return n; });

  const startContact = (ids: string[], channel: MessageChannel, template = 'enquiry_follow_up') => {
    const usable = ids.filter((id) => { const l = byId.get(id); return l && isOpenLead(l.status); });
    if (usable.length < ids.length) toast(`${ids.length - usable.length} lead${ids.length - usable.length === 1 ? ' was' : 's were'} left out because they have already booked or been lost.`);
    if (usable.length === 0) return;
    setContact({ ids: usable, channel, template, title: usable.length === 1 ? `Message ${byId.get(usable[0])!.name}` : `Message ${usable.length} leads` });
  };

  const createBooking = async (lead: Lead) => {
    try {
      const guests = await guestService.list();
      const existing = guests.find((g) => (lead.email && g.email.toLowerCase() === lead.email.toLowerCase()) || samePhone(g.phone, lead.phone));
      const [first, ...rest] = lead.name.trim().split(/\s+/);
      const guest = existing ?? (await guestService.create({
        ...emptyGuest(),
        firstName: first,
        lastName: rest.join(' '),
        email: lead.email,
        phone: lead.phone,
        nationality: '',
      }));
      setBooking({ lead, guestId: guest.id });
    } catch (e) {
      toastError(e);
    }
  };

  const columns: Column<Lead>[] = [
    ...(manage ? [{
      key: 'pick',
      header: 'Select',
      actions: true,
      render: (l: Lead) => <input type="checkbox" className="row-check" aria-label={`Select ${l.name}`} checked={selected.has(l.id)} onChange={() => toggle(l.id)} />,
    }] : []),
    { key: 'lead', header: 'Lead', primary: true, sort: (l) => l.name, render: (l) => <PersonCell name={l.name} sub={l.phone || l.email} /> },
    {
      key: 'source',
      header: 'Source',
      sort: (l) => l.source,
      render: (l) => (
        <span>
          <span className="strong">{LEAD_SOURCE[l.source].short}</span>
          <span className="cell-sub" style={{ display: 'block' }}>{l.sourceDetail}</span>
        </span>
      ),
    },
    { key: 'date', header: 'Enquired', sort: (l) => l.enquiredAt, render: (l) => fmtDate(l.enquiredAt.slice(0, 10)) },
    {
      key: 'wants',
      header: 'Wants',
      hideOnMobile: true,
      render: (l) => (
        <span>
          {l.checkIn && l.checkOut ? `${fmtDayMonth(l.checkIn)} to ${fmtDayMonth(l.checkOut)}` : 'Dates open'}
          <span className="cell-sub" style={{ display: 'block' }}>{crm.categoryById.get(l.categoryId)?.name ?? 'Any room'} · {l.adults} guest{l.adults === 1 ? '' : 's'}</span>
        </span>
      ),
    },
    { key: 'budget', header: 'Budget', num: true, hideOnMobile: true, sort: (l) => l.budget, render: (l) => (l.budget ? money(l.budget) : '–') },
    {
      key: 'status',
      header: 'Status',
      sort: (l) => LEAD_STATUS_ORDER.indexOf(l.status),
      render: (l) => {
        const due = l.followUpOn && isOpenLead(l.status) && l.followUpOn <= today;
        return (
          <span>
            <Badge tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Badge>
            {due && <span className="cell-sub due-flag" style={{ display: 'block' }}>{l.followUpOn < today ? 'Overdue' : 'Due today'}</span>}
          </span>
        );
      },
    },
    { key: 'staff', header: 'Assigned', hideOnMobile: true, sort: (l) => crm.staffById.get(l.assignedTo)?.name ?? '~', render: (l) => (l.assignedTo ? crm.staffById.get(l.assignedTo)?.name.split(' ')[0] : <span className="muted">Unassigned</span>) },
    ...(manage ? [{
      key: 'act',
      header: 'Actions',
      actions: true,
      render: (l: Lead) => isOpenLead(l.status) ? (
        <span className="row" style={{ gap: 6 }}>
          <OutreachButtons name={l.name} onPick={(c) => startContact([l.id], c)} />
          <button type="button" className="share-btn share-sm link-action" aria-label={`Generate booking link for ${l.name}`} title="Generate booking link" data-testid="gen-link" onClick={() => setLinkFor(l)}>
            <Icon name="link" size={15} />
          </button>
        </span>
      ) : <span className="muted small">{l.status === 'converted' ? 'Booked' : 'Closed'}</span>,
    }] : []),
  ];

  const bookingGuestReady = booking && lookups.guestById.has(booking.guestId);
  const contactRecipients = contact ? contact.ids.map((id) => byId.get(id)).filter((l): l is Lead => !!l).map((l) => leadRecipient(l)) : [];

  return (
    <>
      <PageHead
        title="Leads"
        subtitle="Every enquiry in one place, from first message to booking. Sample leads for this demo."
        actions={manage && <Button variant="primary" icon="userPlus" onClick={() => setAdding(true)}>Add lead</Button>}
      />
      <StatGrid>
        <StatCard icon="funnel" label="Total leads" value={crm.leads.length} note={`${crm.leads.filter((l) => isOpenLead(l.status)).length} still open`} />
        <StatCard icon="userPlus" tone="info" label="New today" value={newToday} note="Enquiries received today" />
        <StatCard icon="clock" tone={dueCount ? 'warn' : 'good'} label="Follow-ups due" value={dueCount} note="Today or overdue" to="/app/customers/leads?due=1" />
        <StatCard icon="target" tone="good" label="Conversion rate" value={percent(rate, 1)} note={`${converted} of ${crm.leads.length} became bookings`} />
      </StatGrid>

      <Panel>
        <div style={{ padding: '4px 14px 0' }}>
          <Tabs
            value={status}
            onChange={(id) => { setStatus(id); setSelected(new Set()); }}
            tabs={[
              { id: 'all' as StatusTab, label: 'All', count: counts('all') },
              ...LEAD_STATUS_ORDER.map((s) => ({ id: s as StatusTab, label: LEAD_STATUS[s].label, count: counts(s) })),
            ]}
          />
        </div>
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Name, phone, email or campaign" />
          <select className="input" aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {LEAD_SOURCE_ORDER.map((s) => <option key={s} value={s}>{LEAD_SOURCE[s].label}</option>)}
          </select>
          <select className="input" aria-label="Assigned to" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Anyone</option>
            <option value="none">Unassigned</option>
            {crm.staff.filter((s) => crm.leads.some((l) => l.assignedTo === s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="date-range">
            <span className="small muted">From</span>
            <input type="date" className="input" aria-label="Enquired from" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="date-range">
            <span className="small muted">To</span>
            <input type="date" className="input" aria-label="Enquired to" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="check"><input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} /> Follow-up due</label>
          {manage && rows.length > 0 && <label className="check"><input type="checkbox" checked={allShown} onChange={toggleAll} /> Select all {rows.length}</label>}
        </div>
        {manage && selected.size > 0 && (
          <div className="bulk-bar" role="region" aria-label="Actions for selected leads">
            <b>{selected.size} selected</b>
            <span className="bulk-actions">
              <Button size="sm" onClick={() => startContact([...selected], 'whatsapp')}><span className="inline-logo"><WhatsAppLogo size={16} /></span>WhatsApp</Button>
              <Button size="sm" onClick={() => startContact([...selected], 'email')}><span className="inline-logo"><EmailLogo size={16} /></span>Email</Button>
              <select
                className="input"
                aria-label="Assign selected to"
                value=""
                onChange={async (e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const name = id === 'none' ? '' : crm.staffById.get(id)?.name ?? '';
                  try {
                    await Promise.all([...selected].map((leadId) => leadService.assign(leadId, id === 'none' ? '' : id, name, by)));
                    toast(`${selected.size} lead${selected.size === 1 ? '' : 's'} ${name ? `assigned to ${name}` : 'unassigned'}`);
                  } catch (err) { toastError(err); }
                }}
              >
                <option value="">Assign to…</option>
                <option value="none">Unassigned</option>
                {crm.staff.filter((s) => s.active && s.department !== 'Housekeeping').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </span>
            <button type="button" className="link-btn small" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
        <DataTable
          key={status}
          caption="Leads"
          columns={columns}
          rows={rows}
          rowKey={(l) => l.id}
          pageSize={12}
          defaultSort={{ key: 'date', dir: 'desc' }}
          onRowClick={(l) => setParams((p) => { const n = new URLSearchParams(p); n.set('open', l.id); return n; })}
          empty={<EmptyState icon="funnel" title="No leads match" message="Clear a filter, or add a lead that came in by phone or in person." />}
        />
      </Panel>

      {open && !editing && !linkFor && !contact && !booking && (
        <LeadDetail
          leadId={open.id}
          crm={crm}
          onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('open'); return n; })}
          onContact={(l, c) => startContact([l.id], c)}
          onLink={(l) => setLinkFor(l)}
          onBook={(l) => void createBooking(l)}
          onEdit={(l) => setEditing(l)}
        />
      )}
      {adding && <LeadForm crm={crm} onClose={() => setAdding(false)} />}
      {editing && <LeadForm crm={crm} lead={editing} onClose={() => setEditing(null)} />}
      {linkFor && (
        <BookingLinkModal
          lead={linkFor}
          crm={crm}
          onClose={() => setLinkFor(null)}
          onSend={(channel) => { const l = linkFor; setLinkFor(null); startContact([l.id], channel); }}
        />
      )}
      {contact && contactRecipients.length > 0 && (
        <ContactModal
          recipients={contactRecipients}
          title={contact.title}
          subtitle={contactRecipients.length > 1 ? 'Each message is filled in for its own lead, with their own booking link.' : undefined}
          initialChannel={contact.channel}
          initialTemplateKey={contact.template}
          onClose={() => setContact(null)}
        />
      )}
      {bookingGuestReady && (
        <ReservationFormModal
          lookups={lookups}
          defaults={{
            guestId: booking.guestId,
            ...(booking.lead.categoryId ? { categoryId: booking.lead.categoryId } : {}),
            ...(booking.lead.checkIn && booking.lead.checkIn >= today ? { checkIn: booking.lead.checkIn, checkOut: booking.lead.checkOut } : {}),
          }}
          onClose={() => setBooking(null)}
          onSaved={async (reservation) => {
            try {
              await leadService.linkReservation(booking.lead.id, reservation.id, ' by the desk', by);
              toast(`${booking.lead.name} is now Converted`);
            } catch (e) { toastError(e); }
          }}
        />
      )}
    </>
  );
}
