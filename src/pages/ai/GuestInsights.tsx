import { useState } from 'react';
import { Bars, Legend, RankedBars, SERIES, type SeriesDef } from '@/components/charts';
import { Badge, DataTable, PageHead, Panel, PersonCell, Tabs, type Column } from '@/components/ui';
import { ARRIVAL_DAYS, BOOKING_LEAD, FREQUENT_GUESTS, GUEST_FACTS, GUEST_OPPORTUNITIES, LOYALTY_TIERS, ROOM_PREFERENCES, SEASON_TRENDS, SEASONAL_BOOKINGS, SEGMENTS } from '@/data/aiInsights';
import { AiGrid, DemoButton, FactStrip, InsightCard, ShareBar, SimTag } from '@/features/ai/AiParts';
import { addDays, today } from '@/lib/dates';
import { fmtDate, moneyCompact } from '@/lib/format';

type FrequentGuest = (typeof FREQUENT_GUESTS)[number];

const TIER_COLORS = [SERIES[3], SERIES[0], SERIES[2], SERIES[1]];
const TIER_TONE = { New: 'quiet', Returning: 'info', Regular: 'good', VIP: 'brass' } as const;
const ARRIVAL_SERIES: SeriesDef[] = [{ key: 'arrivals', name: 'Share of arrivals', color: SERIES[0] }];

/** Whole-number shares that always add up to 100, so the bar and the cards never disagree. */
function shares(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  const raw = counts.map((c) => (c / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  [...raw.keys()].sort((a, b) => (raw[b] % 1) - (raw[a] % 1)).forEach((i) => { if (left-- > 0) out[i]++; });
  return out;
}

const LOYALTY_TOTAL = LOYALTY_TIERS.reduce((sum, t) => sum + t.guests, 0);
const LOYALTY_SHARES = shares(LOYALTY_TIERS.map((t) => t.guests));

const FREQUENT_COLUMNS: Column<FrequentGuest>[] = [
  { key: 'guest', header: 'Guest', primary: true, sort: (g) => g.name, render: (g) => <PersonCell name={g.name} vip={g.vip} sub={g.segment} /> },
  { key: 'tier', header: 'Loyalty', sort: (g) => g.tier, render: (g) => <Badge tone={TIER_TONE[g.tier]}>{g.tier}</Badge> },
  { key: 'visits', header: 'Visits', num: true, sort: (g) => g.visits, render: (g) => <span className="strong">{g.visits}</span> },
  { key: 'last', header: 'Last visit', sort: (g) => -g.lastVisitDaysAgo, render: (g) => <span className="nowrap">{fmtDate(addDays(today(), -g.lastVisitDaysAgo))}<span className="muted small"> · {g.lastVisitDaysAgo} days ago</span></span> },
  { key: 'spend', header: 'Lifetime spend', num: true, hideOnMobile: true, sort: (g) => g.spend, render: (g) => moneyCompact(g.spend) },
];

const SEASON_SERIES: SeriesDef[] = [
  { key: 'couples', name: 'Couples', color: SERIES[0] },
  { key: 'families', name: 'Families', color: SERIES[1] },
  { key: 'groups', name: 'Groups', color: SERIES[2] },
  { key: 'business', name: 'Business', color: SERIES[4] },
];

const SEGMENT_COLORS = [SERIES[0], SERIES[1], SERIES[2], SERIES[4], SERIES[3]];

export default function GuestInsights() {
  const [segment, setSegment] = useState(ROOM_PREFERENCES[0].segment);
  const prefs = ROOM_PREFERENCES.find((p) => p.segment === segment) ?? ROOM_PREFERENCES[0];

  return (
    <>
      <PageHead title="Guest Insights" />
      <FactStrip facts={GUEST_FACTS} />

      <Panel
        icon="star"
        title="Guest loyalty"
        subtitle={`${LOYALTY_TOTAL.toLocaleString('en-IN')} guests on record, grouped by how many times they have stayed`}
        actions={<SimTag />}
      >
        <div className="panel-body" data-testid="loyalty-panel">
          <ShareBar parts={LOYALTY_TIERS.map((t, i) => ({ label: t.label, value: LOYALTY_SHARES[i], color: TIER_COLORS[i] }))} />
          <div className="ai-segments">
            {LOYALTY_TIERS.map((t, i) => (
              <article key={t.id} className="ai-segment" data-testid={`loyalty-${t.id}`} style={{ ['--seg' as string]: TIER_COLORS[i] }}>
                <header>
                  <span className="ai-seg-dot" />
                  <h3>{t.label}</h3>
                  <b>{LOYALTY_SHARES[i]}%</b>
                </header>
                <p className="small muted" style={{ margin: '6px 0 0' }}>{t.rule}</p>
                <dl>
                  <div><dt>Guests</dt><dd>{t.guests.toLocaleString('en-IN')}</dd></div>
                  <div><dt>Avg. stays</dt><dd>{t.avgStays.toFixed(1)}</dd></div>
                  <div><dt>Revenue share</dt><dd>{t.revenueShare}%</dd></div>
                  <div><dt>Vs last year</dt><dd>+{t.trend}%</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </Panel>

      <div className="section-gap">
        <Panel icon="users" title="Most frequent guests" subtitle="Ranked by completed stays" actions={<SimTag />}>
          <DataTable caption="Most frequent guests" columns={FREQUENT_COLUMNS} rows={[...FREQUENT_GUESTS]} rowKey={(g) => g.id} pageSize={8} defaultSort={{ key: 'visits', dir: 'desc' }} />
        </Panel>
      </div>

      <Panel
        icon="users"
        title="Guest segments"
        subtitle="Couples, families, business travellers and groups, with solo travellers for completeness"
        actions={<SimTag />}
        className="section-gap"
      >
        <div className="panel-body">
          <ShareBar parts={SEGMENTS.map((s, i) => ({ label: s.label, value: s.share, color: SEGMENT_COLORS[i] }))} />
          <div className="ai-segments">
            {SEGMENTS.map((s, i) => (
              <article key={s.id} className="ai-segment" style={{ ['--seg' as string]: SEGMENT_COLORS[i] }}>
                <header>
                  <span className="ai-seg-dot" />
                  <h3>{s.label}</h3>
                  <b>{s.share}%</b>
                </header>
                <dl>
                  <div><dt>Guests</dt><dd>{s.guests.toLocaleString('en-IN')}</dd></div>
                  <div><dt>Avg. rate</dt><dd>{moneyCompact(s.adr)}</dd></div>
                  <div><dt>Avg. stay</dt><dd>{s.stay} nights</dd></div>
                  <div><dt>Return rate</dt><dd>{s.repeat}%</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid-2-1 section-gap">
        <Panel icon="calendar" title="Seasonal booking patterns" actions={<SimTag />}>
          <div className="panel-body">
            <Bars
              data={SEASONAL_BOOKINGS}
              xKey="season"
              series={SEASON_SERIES}
              stacked
              format={(v) => `${v} stays`}
              axisFormat={(v) => `${v}`}
              height={280}
              label="Stays by season and guest type. Summer is family-led, autumn and winter are couple-led."
            />
            <Legend series={SEASON_SERIES} />
          </div>
        </Panel>
        <Panel icon="bed" title="Room preferences" actions={<SimTag />}>
          <div style={{ padding: '0 14px 4px' }}>
            <Tabs value={segment} onChange={setSegment} tabs={ROOM_PREFERENCES.map((p) => ({ id: p.segment, label: p.segment }))} />
          </div>
          <RankedBars key={segment} rows={prefs.picks} format={(v) => `${v}%`} />
        </Panel>
      </div>

      <Panel icon="calendarRange" title="Seasonal guest trends" subtitle="Who fills each season, how loyal they are and how early they book" actions={<SimTag />} className="section-gap">
        <div className="panel-body">
          <div className="ai-segments" style={{ marginTop: 0 }}>
            {SEASON_TRENDS.map((s) => (
              <article key={s.season} className="ai-segment" data-testid={`season-${s.season.toLowerCase()}`}>
                <header><h3>{s.season}</h3><b>{s.repeat}%</b></header>
                <p className="small muted" style={{ margin: '4px 0 0' }}>repeat guests · led by {s.peak.toLowerCase()}</p>
                <dl>
                  <div><dt>Avg. lead time</dt><dd>{s.lead} days</dd></div>
                </dl>
                <p className="small" style={{ margin: '8px 0 0' }}>{s.note}</p>
              </article>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid-2-1 section-gap">
        <Panel icon="clock" title="How far ahead guests book" subtitle="Share of bookings by lead time" actions={<SimTag />}>
          <RankedBars rows={BOOKING_LEAD} format={(v) => `${v}%`} />
        </Panel>
        <Panel icon="calendar" title="Arrival days" subtitle="Share of weekly check-ins" actions={<SimTag />}>
          <div className="panel-body">
            <Bars data={ARRIVAL_DAYS} xKey="day" series={ARRIVAL_SERIES} format={(v) => `${v}%`} axisFormat={(v) => `${v}%`} height={220} label="Check-ins by weekday. Friday and Saturday carry half of all arrivals." />
          </div>
        </Panel>
      </div>

      <h2 className="ai-section">Opportunities from guest patterns</h2>
      <AiGrid min={290}>
        {GUEST_OPPORTUNITIES.map((o) => (
          <InsightCard
            key={o.id}
            icon={o.icon}
            tone="gold"
            title={o.title}
            body={o.body}
            confidence={o.confidence}
            action={<DemoButton doneLabel="Draft saved (demo)" message="Demo only: nothing was drafted or sent.">{o.action}</DemoButton>}
          />
        ))}
      </AiGrid>
    </>
  );
}
