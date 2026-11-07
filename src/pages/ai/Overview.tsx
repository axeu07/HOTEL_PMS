import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/providers';
import { Icon } from '@/components/icons';
import { Badge, Button, PageHead, Panel, StatCard, StatGrid } from '@/components/ui';
import {
  CANCELLATION_RISKS,
  CANCELLATION_SUMMARY,
  OVERVIEW_ACTIONS,
  OVERVIEW_KPIS,
  OVERVIEW_PREDICTIONS,
  SUMMARIES,
  forecast,
} from '@/data/aiInsights';
import { AiGrid, Confidence, DemoButton, ForecastChart, InsightCard, SimTag } from '@/features/ai/AiParts';
import { money } from '@/lib/format';

const SCORE_CIRCUMFERENCE = 2 * Math.PI * 50;

/** The summary is canned text. "Regenerate" only cycles through three written variants after a pause. */
function SummaryHero() {
  const { hotel } = useApp();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const current = SUMMARIES[index];

  const regenerate = () => {
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setIndex((i) => (i + 1) % SUMMARIES.length);
      setBusy(false);
    }, 1100);
  };

  return (
    <section className="ai-hero" aria-label="AI hotel summary">
      <div className="ai-hero-main">
        <div className="row" style={{ gap: 8 }}>
          <span className="ai-hero-tag"><Icon name="ai" size={13} />Today’s summary for {hotel.name}</span>
        </div>
        {busy ? (
          <div className="ai-writing" aria-live="polite" aria-busy="true">
            <span className="ai-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>Writing a fresh summary…</span>
            <div className="skeleton" style={{ height: 14, width: '92%' }} />
            <div className="skeleton" style={{ height: 14, width: '84%' }} />
            <div className="skeleton" style={{ height: 14, width: '60%' }} />
          </div>
        ) : (
          <div key={index} className="ai-hero-copy">
            <h2>{current.headline}</h2>
            <p>{current.body}</p>
          </div>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <Button size="sm" icon="refresh" onClick={regenerate} loading={busy}>Regenerate summary</Button>
        </div>
      </div>
      <div className="ai-hero-score" role="img" aria-label="Hotel health score 84 out of 100, simulated">
        <svg viewBox="0 0 120 120" width="118" height="118" aria-hidden="true">
          <circle cx="60" cy="60" r="50" className="ai-score-track" />
          <circle cx="60" cy="60" r="50" className="ai-score-arc" strokeDasharray={`${0.84 * SCORE_CIRCUMFERENCE} ${SCORE_CIRCUMFERENCE}`} transform="rotate(-90 60 60)" />
        </svg>
        <div className="ai-score-text"><b>84</b><span>Health score</span></div>
      </div>
    </section>
  );
}

function CancellationWidget() {
  const s = CANCELLATION_SUMMARY;
  return (
    <Panel
      icon="ban"
      title="Cancellation prediction"
      actions={<><SimTag /><DemoButton icon="mail" doneLabel="Reminders queued (demo)" message="Demo only: no reminder emails were sent.">Send reminders to all</DemoButton></>}
    >
      <div className="panel-body">
        <div className="ai-facts" style={{ marginBottom: 14 }}>
          <div className="ai-fact"><span>Bookings flagged</span><b>{s.flagged} <small>of {s.of}</small></b><small>Arrivals in the next 7 days</small></div>
          <div className="ai-fact"><span>Revenue at risk</span><b>{money(s.atRisk)}</b><small>If none of them are reached</small></div>
          <div className="ai-fact"><span>Typical cancel rate</span><b>{s.rate}%</b><small>Over the last 90 days</small></div>
        </div>
        <ul className="ai-risks">
          {CANCELLATION_RISKS.map((r) => (
            <li key={r.id}>
              <div className="ai-risk-main">
                <div className="row-between" style={{ gap: 8 }}>
                  <span>
                    <span className="cell-title">{r.guest}</span>
                    <span className="cell-sub" style={{ display: 'block' }}>{r.code} · {r.category} · {r.stay}</span>
                  </span>
                  <Badge tone={r.risk >= 65 ? 'bad' : 'warn'}>{r.risk}% risk</Badge>
                </div>
                <div className="meter" data-tone={r.risk >= 65 ? 'bad' : 'warn'} aria-hidden="true"><i style={{ width: `${r.risk}%` }} /></div>
                <div className="ai-chips">{r.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
              </div>
              <div className="ai-risk-side">
                <b>{money(r.value)}</b>
                <DemoButton doneLabel="Reminder queued" message={`Demo only: no message was sent to ${r.guest}.`}>Send reminder</DemoButton>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const days = forecast(14);

  return (
    <>
      <PageHead
        title="AI Insights"
        actions={<DemoButton size="md" icon="refresh" doneLabel="Insights refreshed" message="Demo only: the sample insights are unchanged.">Refresh insights</DemoButton>}
      />
      <SummaryHero />

      <StatGrid>
        {OVERVIEW_KPIS.map((k) => (
          <StatCard
            key={k.id}
            icon={k.icon}
            tone={k.tone}
            label={k.label}
            value={k.value}
            trend={k.trend}
            spark={k.spark}
            note={`${k.note} · ${k.confidence}% confidence`}
          />
        ))}
      </StatGrid>

      <div className="grid-2-1">
        <Panel
          icon="calendarRange"
          title="Demand outlook, next 14 days"
          actions={<SimTag />}
        >
          <div className="panel-body">
            <ForecastChart data={days} height={290} />
            <div className="legend" style={{ marginTop: 8 }}>
              <span><i className="chart-swatch" style={{ background: 'var(--c1)' }} />Predicted</span>
              <span><i className="chart-swatch" style={{ background: 'var(--sage)' }} />Likely range</span>
              <span><i className="chart-swatch" style={{ background: 'var(--c2)' }} />Last year</span>
            </div>
          </div>
        </Panel>
        <Panel icon="target" title="Key predictions" actions={<SimTag />}>
          <ul className="ai-list">
            {OVERVIEW_PREDICTIONS.map((p) => (
              <li key={p.id}>
                <span className="ai-list-icon"><Icon name={p.icon} size={16} /></span>
                <span className="grow">
                  <span className="cell-title">{p.title}</span>
                  <span className="cell-sub" style={{ display: 'block' }}>{p.body}</span>
                </span>
                <Confidence value={p.confidence} compact />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <h2 className="ai-section">Recommended actions</h2>
      <AiGrid min={290}>
        {OVERVIEW_ACTIONS.map((a) => (
          <InsightCard
            key={a.id}
            icon={a.icon}
            tone="sage"
            eyebrow={a.impact}
            title={a.title}
            body={a.body}
            action={
              a.to ? (
                <Button size="sm" variant="primary" onClick={() => navigate(a.to)}>{a.cta}</Button>
              ) : (
                <DemoButton variant="primary" doneLabel="Queued (demo)" message="Demo only: no reminders were sent.">{a.cta}</DemoButton>
              )
            }
          />
        ))}
      </AiGrid>

      <div className="section-gap">
        <CancellationWidget />
      </div>
    </>
  );
}
