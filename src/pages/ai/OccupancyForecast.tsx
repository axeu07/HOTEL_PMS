import { useMemo, useState } from 'react';
import { Badge, PageHead, Panel, StatCard, StatGrid } from '@/components/ui';
import { FORECAST_DRIVERS, FORECAST_RANGES, forecast } from '@/data/aiInsights';
import { Confidence, DemoButton, ForecastChart, SimTag } from '@/features/ai/AiParts';
import { parseDate } from '@/lib/dates';
import { fmtDayMonth } from '@/lib/format';

type RangeId = (typeof FORECAST_RANGES)[number]['id'];

function level(demand: number) {
  if (demand >= 85) return { id: 'peak', label: 'Peak' };
  if (demand >= 68) return { id: 'high', label: 'High' };
  if (demand >= 50) return { id: 'steady', label: 'Steady' };
  return { id: 'soft', label: 'Soft' };
}

export default function OccupancyForecast() {
  const [range, setRange] = useState<RangeId>('15');
  const [lastYear, setLastYear] = useState(true);
  const days = FORECAST_RANGES.find((r) => r.id === range)!.days;
  const data = useMemo(() => forecast(days), [days]);

  const avg = Math.round(data.reduce((s, d) => s + d.predicted, 0) / data.length);
  const peak = data.reduce((b, d) => (d.predicted > b.predicted ? d : b), data[0]);
  const low = data.reduce((b, d) => (d.predicted < b.predicted ? d : b), data[0]);
  const hot = data.filter((d) => d.predicted >= 85).length;
  const lastYearAvg = Math.round(data.reduce((s, d) => s + d.lastYear, 0) / data.length);
  // Confidence narrows as the horizon grows.
  const confidence = days <= 7 ? 91 : days <= 15 ? 84 : 73;

  return (
    <>
      <PageHead
        title="Occupancy Forecast"
        actions={
          <div className="segmented" role="group" aria-label="Forecast horizon">
            {FORECAST_RANGES.map((r) => (
              <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
            ))}
          </div>
        }
      />
      <StatGrid>
        <StatCard icon="bed" label={`Average, next ${days} days`} value={`${avg}%`} trend={avg - lastYearAvg} note="points vs last year" meter={avg} />
        <StatCard icon="trendUp" tone="gold" label="Busiest night" value={`${peak.predicted}%`} note={fmtDayMonth(peak.date)} />
        <StatCard icon="trendDown" tone="info" label="Quietest night" value={`${low.predicted}%`} note={fmtDayMonth(low.date)} />
        <StatCard icon="alert" tone="warn" label="Nights above 85%" value={hot} note={hot ? 'Consider protecting rates' : 'No tight nights'} />
      </StatGrid>

      <Panel
        icon="calendarRange"
        title={`Predicted occupancy, next ${days} days`}
        actions={
          <>
            <SimTag />
            <label className="ai-check">
              <input type="checkbox" checked={lastYear} onChange={(e) => setLastYear(e.target.checked)} />
              Compare with last year
            </label>
            <Confidence value={confidence} />
          </>
        }
      >
        <div className="panel-body">
          <ForecastChart key={range} data={data} height={320} showLastYear={lastYear} />
          <div className="legend" style={{ marginTop: 8 }}>
            <span><i className="chart-swatch" style={{ background: 'var(--c1)' }} />Predicted</span>
            <span><i className="chart-swatch" style={{ background: 'var(--sage)' }} />Likely range</span>
            {lastYear && <span><i className="chart-swatch" style={{ background: 'var(--c2)' }} />Last year</span>}
          </div>
        </div>
      </Panel>

      <div className="grid-2-1 section-gap">
        <Panel icon="gauge" title="Demand indicators" actions={<SimTag />}>
          <div className="panel-body">
            <div className="ai-heat" role="list" aria-label="Demand by day">
              {data.map((d) => {
                const l = level(d.demand);
                const date = parseDate(d.date);
                return (
                  <div key={d.date} role="listitem" className="ai-heat-cell" data-level={l.id} title={`${fmtDayMonth(d.date)}: ${l.label} demand, ${d.predicted}% occupancy`}>
                    <small>{date.toLocaleDateString('en-GB', { weekday: 'short' })}</small>
                    <b>{date.getDate()}</b>
                    <span>{d.predicted}%</span>
                    <em>{l.label}</em>
                  </div>
                );
              })}
            </div>
            <div className="legend" style={{ marginTop: 12 }}>
              {['soft', 'steady', 'high', 'peak'].map((id) => (
                <span key={id}><i className="ai-heat-swatch" data-level={id} />{id[0].toUpperCase() + id.slice(1)}</span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel icon="lightbulb" title="What is driving the forecast" actions={<SimTag />}>
          <ul className="ai-list">
            {FORECAST_DRIVERS.map((d) => (
              <li key={d.label}>
                <span className="grow">
                  <span className="cell-title">{d.label}</span>
                  <span className="cell-sub" style={{ display: 'block' }}>{d.detail}</span>
                </span>
                <Badge tone={d.tone}>{d.effect}</Badge>
              </li>
            ))}
          </ul>
          <div className="panel-body">
            <div style={{ marginTop: 12 }}>
              <DemoButton size="md" variant="primary" icon="download" doneLabel="Exported (demo)" message="Demo only: no file was created.">Export forecast</DemoButton>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
