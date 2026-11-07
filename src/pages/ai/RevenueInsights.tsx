import { Bars, Legend, SERIES, type SeriesDef } from '@/components/charts';
import { Badge, DataTable, PageHead, Panel, StatCard, StatGrid, type Column } from '@/components/ui';
import {
  CATEGORY_PERFORMANCE,
  DISCOUNT_BANDS,
  DISCOUNT_FINDINGS,
  REVENUE_OPPORTUNITIES,
  REVENUE_TREND,
  UPSELLS,
} from '@/data/aiInsights';
import { AiGrid, CompareChart, DemoButton, FactStrip, InsightCard, SimTag } from '@/features/ai/AiParts';
import { money, moneyCompact } from '@/lib/format';

type Perf = (typeof CATEGORY_PERFORMANCE)[number];
type Upsell = (typeof UPSELLS)[number];

const PERF_SERIES: SeriesDef[] = [
  { key: 'revpar', name: 'RevPAR', color: SERIES[0] },
  { key: 'target', name: 'Target', color: SERIES[1] },
];

export default function RevenueInsights() {
  const totalOpportunity = REVENUE_OPPORTUNITIES.reduce((s, o) => s + o.impact, 0);

  const perfColumns: Column<Perf>[] = [
    { key: 'cat', header: 'Category', primary: true, sort: (r) => r.category, render: (r) => <span className="cell-title">{r.category}</span> },
    { key: 'occ', header: 'Occupancy', num: true, sort: (r) => r.occupancy, render: (r) => `${r.occupancy}%` },
    { key: 'adr', header: 'Avg. rate', num: true, hideOnMobile: true, sort: (r) => r.adr, render: (r) => money(r.adr) },
    { key: 'revpar', header: 'RevPAR', num: true, sort: (r) => r.revpar, render: (r) => money(r.revpar) },
    {
      key: 'vs',
      header: 'Against target',
      sort: (r) => r.revpar - r.target,
      render: (r) => {
        const gap = Math.round(((r.revpar - r.target) / r.target) * 100);
        return <Badge tone={gap >= 0 ? 'good' : 'warn'}>{gap >= 0 ? '+' : ''}{gap}%</Badge>;
      },
    },
  ];

  const upsellColumns: Column<Upsell>[] = [
    {
      key: 'item',
      header: 'Offer',
      primary: true,
      sort: (r) => r.item,
      render: (r) => (
        <div>
          <div className="cell-title">{r.item}</div>
          <div className="cell-sub">{r.window} · {money(r.price)}</div>
        </div>
      ),
    },
    {
      key: 'take',
      header: 'Take-up now → potential',
      sort: (r) => r.potential - r.now,
      render: (r) => (
        <div className="ai-takeup">
          <div className="meter" data-tone="sage" aria-hidden="true"><i style={{ width: `${r.potential * 2}%`, opacity: 0.35 }} /><i style={{ width: `${r.now * 2}%` }} /></div>
          <span className="small">{r.now}% → <b className="strong">{r.potential}%</b></span>
        </div>
      ),
    },
    { key: 'action', header: '', actions: true, render: (r) => <DemoButton doneLabel="Enabled (demo)" message={`Demo only: "${r.item}" is not being offered to guests.`}>Offer</DemoButton> },
  ];

  return (
    <>
      <PageHead title="Revenue Insights" />
      <StatGrid>
        <StatCard icon="coins" tone="sage" label="Opportunity, next 30 days" value={moneyCompact(totalOpportunity)} trend={9.4} note="Across four ideas, simulated" />
        <StatCard icon="percent" tone="warn" label="Discount leakage" value={moneyCompact(420000)} note="Per quarter, over 15% off" />
        <StatCard icon="gauge" tone="gold" label="RevPAR" value={money(9300)} trend={5.1} note="vs previous month" />
        <StatCard icon="card" tone="info" label="Add-on revenue share" value="8.4%" note="Potential 14% with upselling" meter={60} />
      </StatGrid>

      <h2 className="ai-section" style={{ marginTop: 0 }}>Revenue opportunities</h2>
      <AiGrid min={260}>
        {REVENUE_OPPORTUNITIES.map((o) => (
          <InsightCard
            key={o.id}
            icon={o.icon}
            tone="gold"
            eyebrow={<>+{moneyCompact(o.impact)} / month · {o.effort} effort</>}
            title={o.title}
            body={o.body}
            confidence={o.confidence}
            action={<DemoButton doneLabel="Planned (demo)" message="Demo only: nothing was scheduled or changed.">Plan this</DemoButton>}
          />
        ))}
      </AiGrid>

      <div className="grid-2-1 section-gap">
        <Panel icon="trendUp" title="Revenue, current pace vs optimised" actions={<SimTag />}>
          <div className="panel-body">
            <CompareChart
              data={REVENUE_TREND.map((r) => ({ label: r.week, base: r.actual, better: r.optimised }))}
              baseName="Current pace"
              betterName="With suggestions applied"
              format={(v) => moneyCompact(v)}
              axisFormat={(v) => moneyCompact(v)}
              height={260}
              label="Weekly room revenue. With the suggestions applied the line sits about 5 to 9 percent above the current pace. Simulated."
            />
            <div className="legend" style={{ marginTop: 8 }}>
              <span><i className="chart-swatch" style={{ background: 'var(--c1)' }} />With suggestions applied</span>
              <span><i className="chart-swatch" style={{ background: 'var(--c2)' }} />Current pace</span>
            </div>
          </div>
        </Panel>
        <Panel icon="percent" title="Discount analysis" actions={<SimTag />}>
          <ul className="ai-list">
            {DISCOUNT_BANDS.map((b) => (
              <li key={b.band}>
                <span className="grow">
                  <span className="cell-title">{b.band}</span>
                  <span className="cell-sub" style={{ display: 'block' }}>{b.bookings} bookings · avg. rate {money(b.adr)}</span>
                  <span className="meter" data-tone={b.band === 'Over 20%' ? 'bad' : 'teal'} aria-hidden="true"><i style={{ width: `${b.share * 1.8}%` }} /></span>
                </span>
                <b className="ai-big">{b.share}%</b>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="section-gap">
        <FactStrip facts={DISCOUNT_FINDINGS.map((f) => ({ label: f.label, value: f.value, note: f.note }))} />
      </div>

      <div className="grid-1-1">
        <Panel icon="bed" title="Room category performance" actions={<SimTag />}>
          <div className="panel-body" style={{ paddingBottom: 4 }}>
            <Bars
              data={CATEGORY_PERFORMANCE}
              xKey="category"
              series={PERF_SERIES}
              format={(v) => money(v)}
              axisFormat={(v) => moneyCompact(v)}
              xFormat={(v) => v.replace('The Vasanta ', '').split(' ')[0]}
              height={230}
              label="RevPAR against target for each room category. The Residence and Heritage Suite fall short."
            />
            <Legend series={PERF_SERIES} />
          </div>
          <DataTable columns={perfColumns} rows={CATEGORY_PERFORMANCE} rowKey={(r) => r.category} caption="Room category performance" />
        </Panel>
        <Panel icon="plus" title="Upselling suggestions" actions={<SimTag />}>
          <DataTable columns={upsellColumns} rows={UPSELLS} rowKey={(r) => r.id} caption="Upselling offers and their potential take-up" />
          <div className="panel-body">
          </div>
        </Panel>
      </div>
    </>
  );
}
