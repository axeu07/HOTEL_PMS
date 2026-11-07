import { useMemo } from 'react';
import { Bars, RankedBars, SERIES } from '@/components/charts';
import { Badge, DataTable, PageHead, Panel, StatCard, StatGrid, type Column } from '@/components/ui';
import { COMPETITORS, PRICING, SEASONAL, type PricingRow } from '@/data/aiInsights';
import { Confidence, DemoButton, SimTag } from '@/features/ai/AiParts';
import { money, moneyCompact } from '@/lib/format';

/** Nights in a month times the share of nights sold times rooms times the rate change. */
const monthlyImpact = (r: PricingRow) => Math.round((r.suggested - r.current) * r.rooms * (r.occupancy / 100) * 30);

function Delta({ row }: { row: PricingRow }) {
  const pct = ((row.suggested - row.current) / row.current) * 100;
  if (Math.abs(pct) < 0.05) return <Badge tone="quiet">Hold</Badge>;
  return <Badge tone={pct > 0 ? 'good' : 'warn'}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</Badge>;
}

export default function SmartPricing() {
  const rows = useMemo(() => PRICING.map((r) => ({ ...r, impact: monthlyImpact(r) })), []);
  const total = rows.reduce((s, r) => s + r.impact, 0);
  const raises = rows.filter((r) => r.suggested > r.current).length;
  const avgConfidence = Math.round(rows.reduce((s, r) => s + r.confidence, 0) / rows.length);
  const maxRate = Math.max(...COMPETITORS.map((c) => c.rate));

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'category',
      header: 'Room category',
      primary: true,
      sort: (r) => r.category,
      render: (r) => (
        <div>
          <div className="cell-title">{r.category}</div>
          <div className="cell-sub">{r.rooms} rooms · {r.occupancy}% sold, next 14 days</div>
        </div>
      ),
    },
    { key: 'current', header: 'Current', num: true, sort: (r) => r.current, render: (r) => money(r.current) },
    {
      key: 'suggested',
      header: 'Suggested',
      num: true,
      sort: (r) => r.suggested,
      render: (r) => (
        <div className="ai-rate">
          <b>{money(r.suggested)}</b>
          <Delta row={r} />
        </div>
      ),
    },
    { key: 'market', header: 'Market average', num: true, hideOnMobile: true, sort: (r) => r.competitor, render: (r) => money(r.competitor) },
    { key: 'impact', header: 'Est. impact / month', num: true, hideOnMobile: true, sort: (r) => r.impact, render: (r) => (r.impact === 0 ? <span className="muted">–</span> : <span className={r.impact < 0 ? 'ai-neg' : 'ai-pos'}>{r.impact > 0 ? '+' : ''}{moneyCompact(r.impact)}</span>) },
    { key: 'confidence', header: 'Confidence', hideOnMobile: true, sort: (r) => r.confidence, render: (r) => <Confidence value={r.confidence} compact /> },
    {
      key: 'action',
      header: '',
      actions: true,
      render: (r) =>
        r.suggested === r.current ? (
          <span className="small muted">No change</span>
        ) : (
          <DemoButton doneLabel="Applied (demo)" message={`Demo only: ${r.category} is still ${money(r.current)}. No rate was changed.`}>Apply</DemoButton>
        ),
    },
  ];

  return (
    <>
      <PageHead
        title="Smart Pricing"
        actions={<DemoButton size="md" variant="primary" icon="check" doneLabel="All applied (demo)" message="Demo only: no rate was changed in your hotel.">Apply all suggestions</DemoButton>}
      />
      <StatGrid>
        <StatCard icon="coins" tone="sage" label="Estimated impact" value={moneyCompact(total)} note="Extra revenue per month, simulated" trend={6.8} />
        <StatCard icon="tag" tone="gold" label="Rates to raise" value={`${raises} of ${rows.length}`} note="Categories priced under the market" />
        <StatCard icon="target" label="Average confidence" value={`${avgConfidence}%`} note="Across all suggestions" meter={avgConfidence} />
        <StatCard icon="trendDown" tone="info" label="Occupancy effect" value="-0.6 pts" note="Small, outweighed by the rate gain" />
      </StatGrid>

      <Panel icon="tag" title="Room-wise pricing" actions={<SimTag />}>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} caption="Current and suggested room rates by category" defaultSort={{ key: 'impact', dir: 'desc' }} />
        <div className="panel-body">
        </div>
      </Panel>

      <div className="grid-2-1 section-gap">
        <Panel icon="calendar" title="Seasonal trends" actions={<SimTag />}>
          <div className="panel-body">
            <Bars
              data={SEASONAL}
              xKey="month"
              series={[{ key: 'demand', name: 'Demand index', color: SERIES[0] }]}
              format={(v) => `${v}`}
              axisFormat={(v) => `${v}`}
              height={250}
              label="Demand index by month. November and December are the busiest, July and August the quietest."
            />
          </div>
        </Panel>
        <Panel icon="building" title="Competitor comparison" actions={<SimTag />}>
          <ul className="ai-competitors">
            {[...COMPETITORS].sort((a, b) => b.rate - a.rate).map((c) => (
              <li key={c.name} className={c.position === 'You' ? 'is-you' : undefined}>
                <div className="row-between small">
                  <span className="strong">{c.name}{c.position === 'You' && <span className="badge badge-brass badge-inline">You</span>}</span>
                  <span>{money(c.rate)}</span>
                </div>
                <div className="meter" data-tone={c.position === 'You' ? 'gold' : 'teal'} aria-hidden="true"><i style={{ width: `${(c.rate / maxRate) * 100}%` }} /></div>
                <span className="cell-sub">Rated {c.rating.toFixed(1)} · {c.position === 'You' ? 'Your current rate' : `${c.position} your rate`}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="section-gap">
        <Panel icon="banknote" title="Estimated revenue impact" actions={<SimTag />}>
          <RankedBars rows={rows.filter((r) => r.impact > 0).map((r) => ({ label: r.category, value: r.impact }))} format={(v) => moneyCompact(v)} />
        </Panel>
      </div>
    </>
  );
}
