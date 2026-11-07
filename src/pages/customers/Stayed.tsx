import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RESERVATION_STATUS } from '@/app/labels';
import { useAuth } from '@/app/providers';
import { EmailLogo, WhatsAppLogo } from '@/components/brandIcons';
import { Icon } from '@/components/icons';
import { Avatar, Badge, Button, DataTable, EmptyState, MiniStat, Modal, PageHead, PageLoading, Panel, PersonCell, SearchInput, StatCard, StatGrid, type Column } from '@/components/ui';
import type { StayedGuest } from '@/domain/customers';
import { LOYALTY_LABEL, LOYALTY_ORDER, LOYALTY_RULES, type LoyaltyTier } from '@/domain/loyalty';
import { ContactModal } from '@/features/crm/ContactModal';
import { OutreachButtons } from '@/features/crm/OutreachButtons';
import { guestRecipient } from '@/features/crm/recipients';
import { useCrm, type Crm } from '@/features/crm/useCrm';
import { addDays } from '@/lib/dates';
import { fmtDate, fmtDayMonth, money, moneyCompact, timeAgo } from '@/lib/format';
import { guestName } from '@/services';
import type { MessageChannel } from '@/types/domain';

type Segment = 'all' | 'birthday' | 'lapsed' | 'big_spenders' | 'upcoming';

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'all', label: 'All stayed guests' },
  { id: 'birthday', label: 'Birthday in the next 30 days' },
  { id: 'lapsed', label: 'Not back in 30+ days' },
  { id: 'big_spenders', label: 'Top spenders' },
  { id: 'upcoming', label: 'Has an upcoming booking' },
];

type Campaign = { key: string; label: string; icon: 'gift' | 'cake' | 'refresh' | 'star' };
const CAMPAIGNS: (Campaign & { template: string })[] = [
  { key: 'offer', label: 'Special offer', icon: 'gift', template: 'room_offer' },
  { key: 'birthday', label: 'Birthday offer', icon: 'cake', template: 'birthday' },
  { key: 'repeat', label: 'Repeat-visit offer', icon: 'refresh', template: 'seasonal' },
  { key: 'loyalty', label: 'Loyalty / VIP offer', icon: 'star', template: 'vip_offer' },
];

/* ---------- Profile ---------- */

function GuestProfile({ row, crm, onClose, onContact }: { row: StayedGuest; crm: Crm; onClose: () => void; onContact: (r: StayedGuest, channel: MessageChannel, template?: string) => void }) {
  const { can } = useAuth();
  const { guest } = row;
  const history = crm.communications.filter((c) => c.guestId === guest.id);
  const tier = LOYALTY_LABEL[row.tier];
  return (
    <Modal
      title={guestName(guest)}
      subtitle={guest.company || guest.city || `Guest since ${fmtDate(guest.createdAt.slice(0, 10))}`}
      size="xl"
      onClose={onClose}
      footer={
        can('customers.manage') ? (
          <>
            <Link className="btn" to={`/app/front-desk?new=1&guest=${guest.id}`}><Icon name="plus" />New booking</Link>
            <Button variant="primary" icon="gift" onClick={() => onContact(row, 'whatsapp', row.tier === 'vip' ? 'vip_offer' : 'room_offer')}>Send an offer</Button>
          </>
        ) : undefined
      }
    >
      <div className="stack">
        <div className="profile-hero">
          <Avatar name={guestName(guest)} large />
          <Badge tone={tier.tone}>{tier.label}</Badge>
          <div className="mini-stats grow">
            <MiniStat label="Completed stays" value={row.stays} />
            <MiniStat label="Nights" value={row.nights} />
            <MiniStat label="Total spend" value={money(row.spend)} />
            <MiniStat label="Last visit" value={fmtDayMonth(row.lastVisit)} />
          </div>
        </div>
        <div className="grid-1-1">
          <dl className="dl">
            <dt>Phone</dt><dd>{guest.phone || '–'}</dd>
            <dt>Email</dt><dd>{guest.email || '–'}</dd>
            <dt>City</dt><dd>{guest.city || '–'}</dd>
            <dt>Nationality</dt><dd>{guest.nationality || '–'}</dd>
          </dl>
          <dl className="dl">
            <dt>First visit</dt><dd>{fmtDate(row.firstVisit)}</dd>
            <dt>Last visit</dt><dd>{fmtDate(row.lastVisit)}</dd>
            <dt>Birthday</dt><dd>{guest.birthday ? `${fmtDayMonth(guest.birthday)}${row.birthdayIn !== null && row.birthdayIn <= 30 ? ` · in ${row.birthdayIn} day${row.birthdayIn === 1 ? '' : 's'}` : ''}` : '–'}</dd>
            <dt>Next booking</dt><dd>{row.upcoming ? `${row.upcoming.code}, ${fmtDate(row.upcoming.checkIn)}` : 'None yet'}</dd>
          </dl>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <OutreachButtons name={guestName(guest)} size="md" onPick={(c) => onContact(row, c)} />
          <span className="small muted">{tier.label} guest: {tier.rule}.</span>
        </div>

        <div className="grid-1-1">
          <div>
            <h3 className="contact-h">Booking history</h3>
            <ul className="mini-list list-box" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {row.bookings.map((r) => (
                <li key={r.id} style={{ padding: '8px 12px' }}>
                  <span className="grow">
                    <Link to={`/app/reservations?open=${r.id}`} className="strong">{r.code}</Link>
                    <span className="cell-sub" style={{ display: 'block' }}>{fmtDate(r.checkIn)} to {fmtDate(r.checkOut)} · {crm.categoryById.get(r.categoryId)?.name}</span>
                  </span>
                  <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="contact-h">Communication history</h3>
            {history.length === 0 ? (
              <p className="muted small">No messages prepared for this guest yet.</p>
            ) : (
              <ul className="mini-list list-box" style={{ maxHeight: 260, overflowY: 'auto' }}>
                {history.map((c) => (
                  <li key={c.id} style={{ padding: '8px 12px' }}>
                    {c.channel === 'whatsapp' ? <WhatsAppLogo size={22} /> : <EmailLogo size={22} />}
                    <span className="grow">
                      <span className="strong">{c.templateName}</span>
                      <span className="cell-sub" style={{ display: 'block' }}>{c.by} · {timeAgo(c.at)}{c.demo ? ' · sample' : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Page ---------- */

export default function Stayed() {
  const crm = useCrm();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<LoyaltyTier | ''>('');
  const [segment, setSegment] = useState<Segment>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contact, setContact] = useState<{ ids: string[]; channel: MessageChannel; template?: string; title: string } | null>(null);
  const manage = can('customers.manage');
  const openId = params.get('open');

  const filtered = useMemo(() => {
    if (!crm) return [];
    const q = query.trim().toLowerCase();
    const byFilter = crm.stayed.filter((r) => {
      if (tier && r.tier !== tier) return false;
      if (segment === 'birthday' && !(r.birthdayIn !== null && r.birthdayIn <= 30)) return false;
      if (segment === 'lapsed' && r.lastVisit > addDays(crm.now, -30)) return false;
      if (segment === 'upcoming' && !r.upcoming) return false;
      if (q && !`${guestName(r.guest)} ${r.guest.email} ${r.guest.phone} ${r.guest.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (segment === 'big_spenders') return [...byFilter].sort((a, b) => b.spend - a.spend).slice(0, 40);
    if (segment === 'birthday') return [...byFilter].sort((a, b) => (a.birthdayIn ?? 0) - (b.birthdayIn ?? 0));
    return byFilter;
  }, [crm, query, tier, segment]);

  if (!crm) return <PageLoading />;

  const tierCounts = Object.fromEntries(LOYALTY_ORDER.map((t) => [t, crm.stayed.filter((r) => r.tier === t).length])) as Record<LoyaltyTier, number>;
  const totalSpend = crm.stayed.reduce((s, r) => s + r.spend, 0);
  const repeat = crm.stayed.filter((r) => r.stays > 1).length;
  const byId = new Map(crm.stayed.map((r) => [r.guest.id, r]));
  const open = openId ? byId.get(openId) : undefined;
  const visibleSelected = filtered.filter((r) => selected.has(r.guest.id));
  const allShown = filtered.length > 0 && visibleSelected.length === filtered.length;

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); filtered.forEach((r) => (allShown ? n.delete(r.guest.id) : n.add(r.guest.id))); return n; });

  const startFor = (ids: string[], channel: MessageChannel, template: string | undefined, title: string) => setContact({ ids, channel, template, title });
  const single = (r: StayedGuest, channel: MessageChannel, template?: string) =>
    startFor([r.guest.id], channel, template ?? (r.tier === 'vip' ? 'vip_offer' : 'room_offer'), `Message ${guestName(r.guest)}`);

  const columns: Column<StayedGuest>[] = [
    ...(manage ? [{
      key: 'pick',
      header: 'Select',
      actions: true,
      render: (r: StayedGuest) => <input type="checkbox" className="row-check" aria-label={`Select ${guestName(r.guest)}`} checked={selected.has(r.guest.id)} onChange={() => toggle(r.guest.id)} />,
    }] : []),
    { key: 'guest', header: 'Guest', primary: true, sort: (r) => r.guest.lastName, render: (r) => <PersonCell name={guestName(r.guest)} sub={r.guest.phone || r.guest.email} /> },
    { key: 'email', header: 'Email', hideOnMobile: true, render: (r) => <span className="cell-sub">{r.guest.email || '–'}</span> },
    { key: 'tier', header: 'Loyalty', sort: (r) => LOYALTY_ORDER.indexOf(r.tier), render: (r) => <Badge tone={LOYALTY_LABEL[r.tier].tone}>{LOYALTY_LABEL[r.tier].label}</Badge> },
    { key: 'stays', header: 'Stays', num: true, sort: (r) => r.stays, render: (r) => r.stays },
    { key: 'first', header: 'First visit', hideOnMobile: true, sort: (r) => r.firstVisit, render: (r) => fmtDate(r.firstVisit) },
    { key: 'last', header: 'Last visit', sort: (r) => r.lastVisit, render: (r) => fmtDate(r.lastVisit) },
    { key: 'spend', header: 'Total spend', num: true, sort: (r) => r.spend, render: (r) => <span className="strong">{money(r.spend)}</span> },
    ...(manage ? [{
      key: 'act',
      header: 'Contact',
      actions: true,
      render: (r: StayedGuest) => <OutreachButtons name={guestName(r.guest)} onPick={(c) => single(r, c)} />,
    }] : []),
  ];

  const recipients = contact ? contact.ids.map((id) => byId.get(id)).filter((r): r is StayedGuest => !!r).map((r) => guestRecipient(r, crm)) : [];

  return (
    <>
      <PageHead
        title="Stayed guests"
        subtitle={`${crm.stayed.length} guests have stayed with us. Bring them back with a personal offer.`}
      />
      <div className="stayed-kpis"><StatGrid>
        <StatCard icon="users" label="Guests who stayed" value={crm.stayed.length} note="At least one completed stay" />
        <StatCard icon="refresh" tone="info" label="Returning guests" value={repeat} note={`${crm.stayed.length ? Math.round((repeat / crm.stayed.length) * 100) : 0}% have stayed more than once`} />
        <StatCard icon="coins" tone="good" label="Lifetime spend" value={moneyCompact(totalSpend)} note="Billed to guests who stayed" />
        <StatCard icon="star" tone="gold" label="VIP guests" value={tierCounts.vip} note={LOYALTY_LABEL.vip.rule} active={tier === 'vip'} onClick={() => setTier(tier === 'vip' ? '' : 'vip')} />
      </StatGrid></div>

      <section className="tier-dist" aria-label="Guest loyalty distribution">
        <span className="tier-dist-title">Guest loyalty distribution</span>
        <div className="tier-dist-row">
          {LOYALTY_ORDER.filter((t) => t !== 'vip').map((t) => (
            <button key={t} type="button" className="tier-dist-item" data-tier={t} aria-pressed={tier === t} onClick={() => setTier(tier === t ? '' : t)}>
              <span className="tier-label">{LOYALTY_LABEL[t].label}</span>
              <span className="tier-count">{tierCounts[t]}</span>
              <span className="tier-rule">{LOYALTY_LABEL[t].rule}</span>
            </button>
          ))}
        </div>
      </section>

      <Panel>
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Name, phone, email or city" />
          <select className="input" aria-label="Loyalty tier" value={tier} onChange={(e) => setTier(e.target.value as LoyaltyTier | '')}>
            <option value="">All tiers</option>
            {LOYALTY_ORDER.map((t) => <option key={t} value={t}>{LOYALTY_LABEL[t].label}</option>)}
          </select>
          <select className="input" aria-label="Segment" value={segment} onChange={(e) => setSegment(e.target.value as Segment)}>
            {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {manage && filtered.length > 0 && (
            <label className="check"><input type="checkbox" checked={allShown} onChange={toggleAll} /> Select all {filtered.length}</label>
          )}
        </div>
        {manage && selected.size > 0 && (
          <div className="bulk-bar" role="region" aria-label="Campaign for selected guests">
            <b>{selected.size} selected</b>
            <span className="bulk-actions">
              {CAMPAIGNS.map((c) => (
                <Button key={c.key} size="sm" icon={c.icon} onClick={() => startFor([...selected], 'whatsapp', c.template, `${c.label} for ${selected.size} guest${selected.size === 1 ? '' : 's'}`)}>{c.label}</Button>
              ))}
            </span>
            <button type="button" className="link-btn small" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
        <DataTable
          caption="Guests who have stayed"
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.guest.id}
          pageSize={12}
          defaultSort={{ key: 'last', dir: 'desc' }}
          onRowClick={(r) => setParams({ open: r.guest.id })}
          empty={<EmptyState icon="users" title="No guests match" message="Try another search, tier or segment." />}
        />
      </Panel>
      <p className="small muted" style={{ marginTop: 14 }}>
        Loyalty is worked out from completed stays: New is one stay, Returning two or three, Regular four to six, and VIP seven or more, {money(LOYALTY_RULES.vipSpend)} billed, or a guest marked VIP.
      </p>

      {open && (
        <GuestProfile
          row={open}
          crm={crm}
          onClose={() => setParams({})}
          onContact={(r, channel, template) => { setParams({}); single(r, channel, template); }}
        />
      )}
      {contact && recipients.length > 0 && (
        <ContactModal
          recipients={recipients}
          title={contact.title}
          subtitle={recipients.length > 1 ? 'Each message is filled in for its own guest. Open them one by one.' : undefined}
          initialChannel={contact.channel}
          initialTemplateKey={contact.template}
          onClose={() => setContact(null)}
        />
      )}
    </>
  );
}
