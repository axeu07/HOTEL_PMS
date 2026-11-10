import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers';
import { EmailLogo, WhatsAppLogo } from '@/components/brandIcons';
import { Bars, SERIES } from '@/components/charts';
import { Icon, type IconName } from '@/components/icons';
import { Badge, Button, EmptyState, Meter, Modal, PageLoading, Panel, PersonCell, SearchInput, StatCard } from '@/components/ui';
import { LOYALTY_LABEL, LOYALTY_ORDER } from '@/domain/loyalty';
import { isOpenLead, LEAD_SOURCE, LEAD_SOURCE_ORDER, LEAD_STATUS } from '@/domain/leads';
import { fmtDate, fmtDayMonth, money, moneyCompact, percent, timeAgo } from '@/lib/format';
import { guestName } from '@/services';
import type { Lead, LeadActivityKind } from '@/types/domain';
import { BookingLinkModal } from './BookingLinkModal';
import { ContactModal, type Recipient } from './ContactModal';
import { useCrm, type Crm } from './useCrm';
import { guestRecipient, leadRecipient } from './recipients';

const TIER_COLOR: Record<string, string> = { new: 'var(--sage)', returning: 'var(--c2)', regular: 'var(--accent)', vip: 'var(--gold)' };

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString('en', { month: 'short' });

/** The last `count` calendar months, oldest first, as YYYY-MM. */
function lastMonths(now: string, count: number): string[] {
  const [y, m] = now.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

const touched = (l: Lead) => l.activity.some((a) => ['whatsapp', 'email', 'call'].includes(a.kind)) || (l.status !== 'new' && l.status !== 'lost');
const wasInterested = (l: Lead) => ['interested', 'follow_up', 'converted'].includes(l.status) || l.activity.some((a) => a.kind === 'status' && a.text.includes('Interested'));

const ACTIVITY_ICON: Record<Exclude<LeadActivityKind, 'whatsapp' | 'email'>, IconName> = {
  created: 'userPlus', status: 'funnel', note: 'edit', call: 'phone', link: 'link', link_opened: 'external', booking: 'calendarCheck', follow_up: 'clock',
};

/* ---------- Quick-action dialogs ---------- */

function CampaignPicker({ crm, onPick, onClose }: { crm: Crm; onPick: (title: string, recipients: Recipient[], template: string) => void; onClose: () => void }) {
  const openLeads = crm.leads.filter((l) => isOpenLead(l.status));
  const audiences = [
    { key: 'vip', title: 'VIP and Regular guests', note: 'A loyalty offer to your best guests', template: 'vip_offer', rows: crm.stayed.filter((g) => g.tier === 'vip' || g.tier === 'regular').map((g) => guestRecipient(g, crm)) },
    { key: 'birthday', title: 'Birthdays in the next 30 days', note: 'Birthday wishes with an offer', template: 'birthday', rows: crm.stayed.filter((g) => g.birthdayIn !== null && g.birthdayIn <= 30).map((g) => guestRecipient(g, crm)) },
    { key: 'lapsed', title: 'Guests not back in 60+ days', note: 'A seasonal reason to return', template: 'seasonal', rows: crm.stayed.filter((g) => g.lastVisit <= new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)).map((g) => guestRecipient(g, crm)) },
    { key: 'leads', title: 'Open leads without a booking', note: 'Follow up on enquiries still undecided', template: 'abandoned_enquiry', rows: openLeads.filter((l) => l.status === 'interested' || l.status === 'follow_up').map((l) => leadRecipient(l)) },
  ];
  return (
    <Modal title="Send a campaign" subtitle="Choose who it is for. You will pick the message next." onClose={onClose} footer={<Button onClick={onClose}>Cancel</Button>}>
      <ul className="mini-list list-box">
        {audiences.map((a) => (
          <li key={a.key} style={{ padding: '12px 14px' }}>
            <span className="grow">
              <span className="strong">{a.title}</span>
              <span className="cell-sub" style={{ display: 'block' }}>{a.note}</span>
            </span>
            <Badge tone="quiet">{a.rows.length}</Badge>
            <Button size="sm" variant="primary" disabled={a.rows.length === 0} onClick={() => onPick(a.title, a.rows, a.template)}>Choose</Button>
          </li>
        ))}
      </ul>
      <p className="small muted" style={{ marginTop: 12 }}>For a hand-picked list, select guests on the Stayed page or leads on the Leads page.</p>
    </Modal>
  );
}

function LeadPicker({ crm, onPick, onClose }: { crm: Crm; onPick: (lead: Lead) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const rows = crm.leads.filter((l) => isOpenLead(l.status) && `${l.name} ${l.phone} ${l.email}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
  return (
    <Modal title="Create a booking link" subtitle="Whose personal link is it?" onClose={onClose} footer={<Button onClick={onClose}>Cancel</Button>}>
      <div className="stack-sm">
        <SearchInput value={q} onChange={setQ} placeholder="Search open leads" />
        {rows.length === 0 ? (
          <EmptyState icon="funnel" title="No open leads match" message="Add the lead first, then make their link." />
        ) : (
          <ul className="mini-list list-box" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {rows.map((l) => (
              <li key={l.id} style={{ padding: '8px 12px' }}>
                <span className="grow"><PersonCell name={l.name} sub={`${LEAD_SOURCE[l.source].short} · ${LEAD_STATUS[l.status].label}`} /></span>
                <Button size="sm" icon="link" onClick={() => onPick(l)}>{l.bookingToken ? 'Show link' : 'Create link'}</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/* ---------- KPI group ---------- */

type KpiMetric = { icon: IconName; label: string; value: ReactNode; note: string; tone?: 'good' | 'warn' | 'info' | 'sage' | 'gold'; to?: string; testId?: string; meter?: number };

/** One card holding three metrics side by side. Same data as the individual StatCards it replaces. */
function KpiGroup({ label, metrics }: { label: string; metrics: KpiMetric[] }) {
  return (
    <section className="kpi-group" aria-label={label}>
      {metrics.map((m) => {
        const body = (
          <>
            <div className="stat-top">
              <span className="stat-icon"><Icon name={m.icon} size={15} /></span>
              <span className="ledger-label">{m.label}</span>
            </div>
            <div className="ledger-value" data-testid={m.testId}>{m.value}</div>
            {m.meter !== undefined && <Meter value={m.meter} tone={m.tone} />}
            <div className="ledger-note" title={m.note}>{m.note}</div>
          </>
        );
        return m.to
          ? <Link key={m.label} className="kpi-metric is-link" data-tone={m.tone ?? 'teal'} to={m.to}>{body}</Link>
          : <div key={m.label} className="kpi-metric" data-tone={m.tone ?? 'teal'}>{body}</div>;
      })}
    </section>
  );
}

/* ---------- Dashboard ---------- */

export function LeadDashboard() {
  const crm = useCrm();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | 'campaign' | 'link'>(null);
  const [linkFor, setLinkFor] = useState<Lead | null>(null);
  const [contact, setContact] = useState<{ title: string; recipients: Recipient[]; template?: string; channel: 'whatsapp' | 'email' } | null>(null);
  const manage = can('customers.manage');
  const showRevenue = can('dashboard.revenue');

  const view = useMemo(() => {
    if (!crm) return null;
    const { now, leads } = crm;
    const open = leads.filter((l) => isOpenLead(l.status));
    const converted = leads.filter((l) => l.status === 'converted');
    const bookings = converted.filter((l) => {
      const r = l.reservationId ? crm.reservationById.get(l.reservationId) : undefined;
      return r && !['cancelled', 'no_show'].includes(r.status);
    });
    const revenue = bookings.reduce((s, l) => s + crm.revenueOf(l), 0);
    const due = open.filter((l) => l.followUpOn && l.followUpOn <= now).sort((a, b) => a.followUpOn.localeCompare(b.followUpOn));
    const sources = LEAD_SOURCE_ORDER.map((s) => {
      const list = leads.filter((l) => l.source === s);
      return { source: s, count: list.length, won: list.filter((l) => l.status === 'converted').length };
    }).filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
    const months = lastMonths(now, 6);
    const trend = months.map((m) => {
      const cohort = leads.filter((l) => monthKey(l.enquiredAt) === m);
      return { month: m, leads: cohort.length, converted: cohort.filter((l) => l.status === 'converted').length };
    });
    const revenueByMonth = months.map((m) => ({ month: m, revenue: bookings.filter((l) => l.convertedAt && monthKey(l.convertedAt) === m).reduce((s, l) => s + crm.revenueOf(l), 0) }));
    const funnel = [
      { label: 'Enquiries', count: leads.length },
      { label: 'Contacted', count: leads.filter(touched).length },
      { label: 'Interested', count: leads.filter(wasInterested).length },
      { label: 'Booked', count: converted.length },
    ];
    const tiers = LOYALTY_ORDER.map((t) => ({ tier: t, count: crm.stayed.filter((g) => g.tier === t).length }));
    const returning = crm.stayed.filter((g) => g.stays > 1).length;

    const feed = [
      ...leads.flatMap((l) => l.activity.map((a) => ({ id: a.id, at: a.at, kind: a.kind as LeadActivityKind, text: `${l.name}: ${a.text}`, by: a.by, to: `/app/customers/leads?open=${l.id}` }))),
      ...crm.communications.filter((c) => c.guestId).map((c) => ({ id: c.id, at: c.at, kind: c.channel as LeadActivityKind, text: `${guestName(crm.guestById.get(c.guestId!))}: ${c.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} prepared, ${c.templateName}`, by: c.by, to: '/app/customers/stayed' })),
    ].filter((a) => a.at <= new Date().toISOString()).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

    const untouchedNew = leads.filter((l) => l.status === 'new' && !touched(l));
    const openedNoBooking = open.filter((l) => l.linkOpenedAt);
    const interestedNoLink = open.filter((l) => l.status === 'interested' && !l.bookingToken);
    const birthdaysSoon = crm.stayed.filter((g) => g.birthdayIn !== null && g.birthdayIn <= 7);
    return { open, converted, bookings, revenue, due, sources, trend, revenueByMonth, funnel, tiers, returning, feed, untouchedNew, openedNoBooking, interestedNoLink, birthdaysSoon };
  }, [crm]);

  if (!crm || !view) return <PageLoading />;
  const { now, leads } = crm;
  const rate = leads.length ? (view.converted.length / leads.length) * 100 : 0;
  const newToday = leads.filter((l) => l.enquiredAt.slice(0, 10) === now).length;
  const recent = leads.slice(0, 6);
  const top = view.sources[0]?.count ?? 1;

  const recommendations: { key: string; tone: 'warn' | 'bad' | 'info'; text: string; action: string; run: () => void }[] = [];
  if (view.untouchedNew.length) recommendations.push({ key: 'new', tone: 'bad', text: `${view.untouchedNew.length} new ${view.untouchedNew.length === 1 ? 'lead has' : 'leads have'} not been contacted yet. Fast replies convert best.`, action: 'Contact now', run: () => navigate('/app/customers/leads?status=new') });
  if (view.openedNoBooking.length) recommendations.push({ key: 'opened', tone: 'warn', text: `${view.openedNoBooking.length} ${view.openedNoBooking.length === 1 ? 'lead opened' : 'leads opened'} their booking link without booking. A short nudge can close it.`, action: 'View leads', run: () => navigate('/app/customers/leads') });
  if (view.interestedNoLink.length) recommendations.push({ key: 'nolink', tone: 'info', text: `${view.interestedNoLink.length} interested ${view.interestedNoLink.length === 1 ? 'lead has' : 'leads have'} no booking link yet.`, action: 'Create a link', run: () => setDialog('link') });
  if (view.birthdaysSoon.length) recommendations.push({ key: 'bday', tone: 'info', text: `${view.birthdaysSoon.length} past ${view.birthdaysSoon.length === 1 ? 'guest has a birthday' : 'guests have birthdays'} in the next 7 days.`, action: 'Send wishes', run: () => setContact({ title: `Birthday wishes for ${view.birthdaysSoon.length} guests`, recipients: view.birthdaysSoon.map((g) => guestRecipient(g, crm)), template: 'birthday', channel: 'whatsapp' }) });

  const quick: { label: string; icon: IconName; run: () => void; manage?: boolean }[] = [
    { label: 'Add lead', icon: 'userPlus', run: () => navigate('/app/customers/leads?new=1'), manage: true },
    { label: 'Send campaign', icon: 'megaphone', run: () => setDialog('campaign'), manage: true },
    { label: 'Create booking link', icon: 'link', run: () => setDialog('link'), manage: true },
    { label: 'View follow-ups', icon: 'clock', run: () => navigate('/app/customers/leads?due=1') },
  ];

  return (
    <>
      <div className="quick-actions-row" role="group" aria-label="Quick actions">
        {quick.filter((q) => !q.manage || manage).map((q) => (
          <button key={q.label} type="button" className="quick-action" onClick={q.run}>
            <span className="qa-icon"><Icon name={q.icon} size={16} /></span>{q.label}
          </button>
        ))}
      </div>

      <div className="lead-kpi-grid">
        <KpiGroup label="Lead overview" metrics={[
          { icon: 'funnel', label: 'Total leads', testId: 'kpi-total-leads', value: leads.length, note: `${view.open.length} still open`, to: '/app/customers/leads' },
          { icon: 'userPlus', tone: 'info', label: 'New leads today', testId: 'kpi-new-leads', value: newToday, note: 'Enquiries received today', to: '/app/customers/leads' },
          { icon: 'clock', tone: view.due.length ? 'warn' : 'good', label: 'Pending follow-ups', testId: 'kpi-followups', value: view.due.length, note: 'Due today or overdue', to: '/app/customers/leads?due=1' },
        ]} />
        <KpiGroup label="Lead performance" metrics={[
          { icon: 'calendarCheck', tone: 'sage', label: 'Bookings from leads', testId: 'kpi-lead-bookings', value: view.bookings.length, note: 'Not cancelled' },
          showRevenue
            ? { icon: 'coins', tone: 'gold', label: 'Revenue from leads', testId: 'kpi-lead-revenue', value: moneyCompact(view.revenue), note: 'Billed on converted leads' }
            : { icon: 'star', tone: 'gold', label: 'VIP guests', value: view.tiers.find((t) => t.tier === 'vip')?.count ?? 0, note: 'Top loyalty tier', to: '/app/customers/stayed' },
          { icon: 'target', tone: 'good', label: 'Conversion rate', testId: 'kpi-conversion', value: percent(rate, 1), meter: rate, note: `${view.converted.length} of ${leads.length} leads booked` },
        ]} />
      </div>
      <div className="lead-kpi-grid">
        <StatCard icon="refresh" tone="info" label="Returning guests" testId="kpi-returning" value={view.returning} note={`${crm.stayed.length ? Math.round((view.returning / crm.stayed.length) * 100) : 0}% of guests who stayed`} to="/app/customers/stayed" />
        <StatCard icon="users" label="Guests who stayed" value={crm.stayed.length} note="In the loyalty programme" to="/app/customers/stayed" />
      </div>

      <div className="grid-1-1 section-gap">
        <Panel title="Leads by source" icon="funnel" subtitle="Where enquiries come from, and how many of each booked.">
          <div className="panel-body">
            <ul className="source-list">
              {view.sources.map((s, i) => (
                <li key={s.source} className="source-row" style={{ ['--src' as string]: SERIES[i % SERIES.length] }}>
                  <div className="row-between">
                    <span className="strong">{LEAD_SOURCE[s.source].short}</span>
                    <span>{s.count} <span className="source-meta">· {s.won} booked ({percent((s.won / s.count) * 100)})</span></span>
                  </div>
                  <div className="meter" aria-hidden="true"><i style={{ width: `${(s.count / top) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Conversion funnel" icon="target" subtitle="How far enquiries get on the way to a booking.">
          <div className="panel-body">
            <div className="funnel" role="img" aria-label={`Funnel: ${view.funnel.map((f) => `${f.label} ${f.count}`).join(', ')}`}>
              {view.funnel.map((f, i) => (
                <div key={f.label} className="funnel-row">
                  <span className="funnel-label">{f.label}</span>
                  <div className="funnel-track">
                    <div className="funnel-fill" style={{ width: `${Math.max(12, (f.count / Math.max(1, view.funnel[0].count)) * 100)}%`, opacity: 1 - i * 0.12 }}>
                      <span>{f.count}</span>
                      {i > 0 && <small>{percent((f.count / Math.max(1, view.funnel[0].count)) * 100)}</small>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid-1-1 section-gap">
        <Panel title="Monthly lead trend" icon="chart" subtitle="Enquiries received each month, and how many of them booked.">
          <div className="panel-body">
            <Bars
              data={view.trend}
              xKey="month"
              series={[{ key: 'leads', name: 'Leads', color: SERIES[0] }, { key: 'converted', name: 'Became bookings', color: SERIES[3] }]}
              format={(v) => String(v)}
              axisFormat={(v) => String(v)}
              xFormat={monthLabel}
              label={`Leads per month: ${view.trend.map((t) => `${monthLabel(t.month)} ${t.leads}`).join(', ')}`}
            />
            <div className="legend" style={{ marginTop: 6 }}>
              <span><i className="chart-swatch" style={{ background: SERIES[0] }} />Leads</span>
              <span><i className="chart-swatch" style={{ background: SERIES[3] }} />Became bookings</span>
            </div>
          </div>
        </Panel>
        {showRevenue ? (
          <Panel title="Revenue from converted leads" icon="coins" subtitle="Billed on bookings that began as a lead, by month of booking.">
            <div className="panel-body">
              <Bars
                data={view.revenueByMonth}
                xKey="month"
                series={[{ key: 'revenue', name: 'Revenue', color: SERIES[0] }]}
                format={(v) => money(v)}
                axisFormat={moneyCompact}
                xFormat={monthLabel}
                label={`Revenue from converted leads: ${view.revenueByMonth.map((t) => `${monthLabel(t.month)} ${money(t.revenue)}`).join(', ')}`}
              />
            </div>
          </Panel>
        ) : (
          <Panel title="Follow-up reminders" icon="clock" subtitle="Leads waiting on a call or message.">
            <div className="panel-body"><p className="muted">Revenue figures are shown to roles with revenue access.</p></div>
          </Panel>
        )}
      </div>

      <div className="grid-1-1 section-gap">
        <Panel title="Follow-up reminders" icon="clock" subtitle={view.due.length ? `${view.due.length} due today or overdue` : 'Nothing is waiting'} actions={<Link className="btn btn-sm" to="/app/customers/leads?due=1">All follow-ups</Link>}>
          {view.due.length === 0 ? (
            <EmptyState icon="check" title="All caught up" message="No follow-ups are due." />
          ) : (
            <ul className="reminder-list">
              {view.due.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <span className="reminder-tone" data-tone={l.followUpOn < now ? 'bad' : 'warn'} />
                  <span className="grow">
                    <span className="cell-title">{l.name}</span>
                    <span className="cell-sub" style={{ display: 'block' }}>{l.followUpOn < now ? `Overdue since ${fmtDayMonth(l.followUpOn)}` : 'Due today'} · {LEAD_SOURCE[l.source].short}</span>
                  </span>
                  <Link className="btn btn-sm" to={`/app/customers/leads?open=${l.id}`}>Open</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recommended actions" icon="lightbulb" subtitle="What is most likely to win a booking today.">
          {recommendations.length === 0 ? (
            <EmptyState icon="check" title="Nothing urgent" message="Every lead has been looked after." />
          ) : (
            <ul className="reminder-list">
              {recommendations.map((r) => (
                <li key={r.key}>
                  <span className="reminder-tone" data-tone={r.tone === 'info' ? undefined : r.tone} />
                  <span className="grow small">{r.text}</span>
                  <Button size="sm" onClick={r.run}>{r.action}</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid-1-1 section-gap">
        <Panel title="Recent leads" icon="userPlus" subtitle="The latest enquiries." actions={<Link className="btn btn-sm" to="/app/customers/leads">All leads</Link>}>
          <ul className="reminder-list">
            {recent.map((l) => (
              <li key={l.id}>
                <span className="grow"><PersonCell name={l.name} sub={`${LEAD_SOURCE[l.source].short} · ${fmtDate(l.enquiredAt.slice(0, 10))}`} /></span>
                <Badge tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Badge>
                <Link className="btn btn-sm" to={`/app/customers/leads?open=${l.id}`}>Open</Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Latest customer activity" icon="activity" subtitle="Messages, links and bookings, newest first.">
          <ul className="reminder-list">
            {view.feed.map((a) => (
              <li key={a.id}>
                {a.kind === 'whatsapp' ? <WhatsAppLogo size={22} /> : a.kind === 'email' ? <EmailLogo size={22} /> : <span className="act-icon"><Icon name={ACTIVITY_ICON[a.kind as Exclude<LeadActivityKind, 'whatsapp' | 'email'>]} size={13} /></span>}
                <Link to={a.to} className="grow small" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {a.text}
                  <span className="cell-sub" style={{ display: 'block' }}>{a.by} · {timeAgo(a.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid-1-1 section-gap">
        <Panel title="Returning guests and loyalty" icon="star" subtitle={`${view.returning} of ${crm.stayed.length} guests who stayed have come back.`} actions={<Link className="btn btn-sm" to="/app/customers/stayed">Open guests</Link>}>
          <div className="panel-body">
            <div className="tier-mix" role="img" aria-label={`Loyalty mix: ${view.tiers.map((t) => `${LOYALTY_LABEL[t.tier].label} ${t.count}`).join(', ')}`}>
              {view.tiers.map((t) => <i key={t.tier} style={{ width: `${(t.count / Math.max(1, crm.stayed.length)) * 100}%`, background: TIER_COLOR[t.tier] }} />)}
            </div>
            <div className="tier-legend">
              {view.tiers.map((t) => (
                <span key={t.tier}><i className="dot-swatch" style={{ background: TIER_COLOR[t.tier] }} />{LOYALTY_LABEL[t.tier].label}<b>{t.count}</b></span>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Hotel modules" icon="layers" subtitle="Everything else in the hotel is one click away.">
          <ModuleLinks />
        </Panel>
      </div>

      {dialog === 'campaign' && (
        <CampaignPicker
          crm={crm}
          onClose={() => setDialog(null)}
          onPick={(title, recipients, template) => { setDialog(null); setContact({ title: `${title} (${recipients.length})`, recipients, template, channel: 'whatsapp' }); }}
        />
      )}
      {dialog === 'link' && <LeadPicker crm={crm} onClose={() => setDialog(null)} onPick={(l) => { setDialog(null); setLinkFor(l); }} />}
      {linkFor && (
        <BookingLinkModal
          lead={linkFor}
          crm={crm}
          onClose={() => setLinkFor(null)}
          onSend={(channel) => { const l = linkFor; setLinkFor(null); setContact({ title: `Message ${l.name}`, recipients: [leadRecipient(l)], template: 'enquiry_follow_up', channel }); }}
        />
      )}
      {contact && (
        <ContactModal
          recipients={contact.recipients}
          title={contact.title}
          subtitle={contact.recipients.length > 1 ? 'Each message is filled in for its own recipient. Open them one by one.' : undefined}
          initialChannel={contact.channel}
          initialTemplateKey={contact.template}
          onClose={() => setContact(null)}
        />
      )}
    </>
  );
}

/** Links to the modules that no longer have a sidebar row, limited to what the role may open. */
export function ModuleLinks() {
  const { can } = useAuth();
  const modules: { to: string; label: string; icon: IconName; perm?: Parameters<typeof can>[0] }[] = [
    { to: '/app/reservations', label: 'Reservations', icon: 'calendar', perm: 'reservations.view' },
    { to: '/app/restaurant', label: 'Restaurant', icon: 'fork', perm: 'restaurant.use' },
    { to: '/app/reports', label: 'Reports', icon: 'chart', perm: 'reports.view' },
    { to: '/app/staff', label: 'Staff', icon: 'badge', perm: 'staff.view' },
    { to: '/app/quick-actions', label: 'Quick actions', icon: 'tasks', perm: 'quickactions.view' },
    { to: '/app/settings', label: 'Settings', icon: 'gear' },
  ];
  return (
    <div className="more-modules">
      {modules.filter((m) => !m.perm || can(m.perm)).map((m) => (
        <Link key={m.to} className="btn" to={m.to}><Icon name={m.icon} />{m.label}</Link>
      ))}
    </div>
  );
}
