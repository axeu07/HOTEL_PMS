import { useState } from 'react';
import { Bars, SERIES } from '@/components/charts';
import { Badge, PageHead, Panel, StatCard, StatGrid } from '@/components/ui';
import { CHECKIN_HOURS, CHECKOUT_HOURS, TIMING_ALERTS, TIMING_BY_DAY } from '@/data/aiInsights';
import { AiGrid, DemoButton, InsightCard, SimTag } from '@/features/ai/AiParts';

type Mode = 'in' | 'out';

export default function GuestTiming() {
  const [mode, setMode] = useState<Mode>('in');
  const inbound = mode === 'in';
  const data = inbound ? CHECKIN_HOURS : CHECKOUT_HOURS;
  const key = inbound ? 'checkIns' : 'checkOuts';
  const peak = data.reduce((best, d) => (d[key] > best[key] ? d : best), data[0]);
  const maxDay = Math.max(...TIMING_BY_DAY.flatMap((d) => [d.arrivals, d.departures]));

  return (
    <>
      <PageHead title="Guest Timing" />
      <StatGrid>
        <StatCard icon="login" tone="teal" label="Busiest check-in hour" value="4 pm" note="27 arrivals expected" />
        <StatCard icon="logout" tone="gold" label="Busiest checkout hour" value="11 am" note="31 departures expected" />
        <StatCard icon="clock" tone="info" label="Tightest turn-around" value="2 h 40 m" note="Between checkout and next arrival" />
        <StatCard icon="users" tone="sage" label="Rooms needing a same-day turn" value="18" note="Ready before 3 pm" />
      </StatGrid>

      <div className="grid-2-1">
        <Panel
          icon="clock"
          title={inbound ? 'Expected check-ins by hour' : 'Expected checkouts by hour'}
          actions={
            <div className="segmented" role="group" aria-label="Show">
              <button type="button" aria-pressed={inbound} onClick={() => setMode('in')}>Check-ins</button>
              <button type="button" aria-pressed={!inbound} onClick={() => setMode('out')}>Check-outs</button>
            </div>
          }
        >
          <div className="panel-body">
            <Bars
              key={mode}
              data={data}
              xKey="label"
              series={[{ key, name: inbound ? 'Check-ins' : 'Check-outs', color: inbound ? SERIES[0] : SERIES[1] }]}
              format={(v) => `${v} guests`}
              axisFormat={(v) => `${v}`}
              height={280}
              label={`Predicted ${inbound ? 'check-ins' : 'check-outs'} per hour. The peak is at ${peak.label}.`}
            />
            <div className="ai-windows">
              <span className="ai-window"><i style={{ background: 'var(--c1)' }} />Busiest window <b>{inbound ? '3 – 5 pm' : '10 am – 12 pm'}</b></span>
              <span className="ai-window"><i style={{ background: 'var(--sage)' }} />Calm window <b>{inbound ? 'after 7 pm' : 'after 1 pm'}</b></span>
              <SimTag />
            </div>
          </div>
        </Panel>

        <Panel icon="calendar" title="Typical week" actions={<SimTag />}>
          <ul className="ai-week">
            {TIMING_BY_DAY.map((d) => (
              <li key={d.day}>
                <span className="ai-week-day">{d.day}</span>
                <span className="grow">
                  <span className="ai-twin" aria-hidden="true">
                    <i style={{ width: `${(d.arrivals / maxDay) * 100}%`, background: 'var(--c1)' }} />
                    <i style={{ width: `${(d.departures / maxDay) * 100}%`, background: 'var(--c2)' }} />
                  </span>
                  <span className="cell-sub">In {d.peakIn} · Out {d.peakOut}</span>
                </span>
                <span className="small strong nowrap">{d.arrivals} / {d.departures}</span>
              </li>
            ))}
          </ul>
          <div className="legend" style={{ padding: '0 22px 16px' }}>
            <span><i className="chart-swatch" style={{ background: 'var(--c1)' }} />Arrivals</span>
            <span><i className="chart-swatch" style={{ background: 'var(--c2)' }} />Departures</span>
          </div>
        </Panel>
      </div>

      <h2 className="ai-section">Staff preparation alerts</h2>
      <AiGrid min={300}>
        {TIMING_ALERTS.map((a) => (
          <InsightCard
            key={a.id}
            icon={a.tone === 'good' ? 'check' : a.tone === 'info' ? 'broom' : 'alert'}
            tone={a.tone}
            eyebrow={<Badge tone={a.tone}>{a.when}</Badge>}
            title={a.title}
            body={a.body}
            confidence={a.confidence}
            action={<DemoButton doneLabel="Alert sent (demo)" message="Demo only: no team member was notified.">{a.action}</DemoButton>}
          />
        ))}
      </AiGrid>
    </>
  );
}
