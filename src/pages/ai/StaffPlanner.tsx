import { useMemo } from 'react';
import { Bars, Legend, SERIES, type SeriesDef } from '@/components/charts';
import { Badge, PageHead, Panel, StatCard, StatGrid } from '@/components/ui';
import { SHIFTS, STAFF_KPIS, STAFF_RECOMMENDATIONS, shiftLoadFor, workload } from '@/data/aiInsights';
import { AiGrid, DemoButton, InsightCard, SimTag } from '@/features/ai/AiParts';
import { parseDate } from '@/lib/dates';
import { fmtDayMonth } from '@/lib/format';

const HOURS: SeriesDef[] = [
  { key: 'hoursNeeded', name: 'Hours needed', color: SERIES[0] },
  { key: 'hoursScheduled', name: 'Hours scheduled', color: SERIES[1] },
];

function loadLevel(v: number) {
  if (v > 100) return { id: 'over', label: 'Over capacity' };
  if (v >= 80) return { id: 'high', label: 'Busy' };
  if (v >= 50) return { id: 'ok', label: 'Comfortable' };
  return { id: 'low', label: 'Light' };
}

export default function StaffPlanner() {
  const days = useMemo(() => workload(), []);
  const shortfall = days.filter((d) => d.hoursNeeded > d.hoursScheduled);

  return (
    <>
      <PageHead title="Staff Planner" />
      <StatGrid>
        {STAFF_KPIS.map((k, i) => (
          <StatCard
            key={k.label}
            icon={(['broom', 'clock', 'alert', 'check'] as const)[i]}
            tone={(['teal', 'warn', 'bad', 'sage'] as const)[i]}
            label={k.label}
            value={k.value}
            note={k.note}
          />
        ))}
      </StatGrid>

      <div className="grid-2-1">
        <Panel icon="broom" title="Housekeeping workload" actions={<SimTag />}>
          <div className="panel-body">
            <Bars
              data={days}
              xKey="date"
              series={HOURS}
              format={(v) => `${v} h`}
              axisFormat={(v) => `${v}h`}
              xFormat={(v) => parseDate(v).toLocaleDateString('en-GB', { weekday: 'short' })}
              height={270}
              label={`Hours needed against scheduled, by day. ${shortfall.length} of 7 days are short of hours.`}
            />
            <Legend series={HOURS} />
          </div>
        </Panel>
        <Panel icon="bed" title="Rooms to clean" actions={<SimTag />}>
          <ul className="ai-list">
            {days.map((d) => (
              <li key={d.date}>
                <span className="grow">
                  <span className="cell-title">{parseDate(d.date).toLocaleDateString('en-GB', { weekday: 'long' })}</span>
                  <span className="cell-sub" style={{ display: 'block' }}>{fmtDayMonth(d.date)} · {d.turnRooms} same-day turns</span>
                </span>
                <b className="ai-big">{d.roomsToClean}</b>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="section-gap">
        <Panel icon="clock" title="Busy shifts" actions={<SimTag />}>
          <div className="panel-body">
            <div className="ai-shifts" role="table" aria-label="Predicted load by day and shift">
              <div className="ai-shift-row ai-shift-head" role="row">
                <span role="columnheader" />
                {SHIFTS.map((s) => <span key={s} role="columnheader">{s}</span>)}
              </div>
              {days.map((d) => (
                <div key={d.date} className="ai-shift-row" role="row">
                  <span role="rowheader" className="ai-shift-day">
                    {parseDate(d.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                    <small>{fmtDayMonth(d.date)}</small>
                  </span>
                  {shiftLoadFor(d.date).map((v, j) => {
                    const l = loadLevel(v);
                    return (
                      <span key={SHIFTS[j]} role="cell" className="ai-shift" data-level={l.id} title={`${SHIFTS[j]}: ${v}% of capacity, ${l.label}`}>
                        <b>{v}%</b>
                        <small>{l.label}</small>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <h2 className="ai-section">Staffing recommendations</h2>
      <AiGrid min={290}>
        {STAFF_RECOMMENDATIONS.map((r) => (
          <InsightCard
            key={r.id}
            icon={r.tone === 'good' ? 'check' : 'user'}
            tone={r.tone}
            eyebrow={<Badge tone={r.tone}>{r.priority} priority</Badge>}
            title={r.title}
            body={r.body}
            confidence={r.confidence}
            meta={<span className="ai-impact">{r.impact}</span>}
            action={<DemoButton doneLabel="Added to plan (demo)" message="Demo only: the roster was not changed and no one was notified.">Add to plan</DemoButton>}
          />
        ))}
      </AiGrid>
    </>
  );
}
