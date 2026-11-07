import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SERIES } from '@/components/charts';
import { Icon, type IconName } from '@/components/icons';
import { Button, useFeedback } from '@/components/ui';
import { type ForecastDay } from '@/data/aiInsights';
import { fmtDayMonth } from '@/lib/format';

/* ---------- Labels ---------- */

/** A small "Simulated" tag for cards, charts and generated text. */
export function SimTag({ children = 'Simulated' }: { children?: ReactNode }) {
  return <span className="ai-sim"><Icon name="ai" size={11} />{children}</span>;
}


/* ---------- Confidence ---------- */

export function confidenceLabel(value: number) {
  return value >= 85 ? 'High' : value >= 70 ? 'Medium' : 'Low';
}

/** A ring and the percentage beside it. The words matter as much as the colour. */
export function Confidence({ value, compact }: { value: number; compact?: boolean }) {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const level = value >= 85 ? 'high' : value >= 70 ? 'mid' : 'low';
  return (
    <span className={`ai-conf ai-conf-${level}`} title={`Simulated confidence: ${value}%`}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r={radius} className="ai-conf-track" />
        <circle
          cx="14"
          cy="14"
          r={radius}
          className="ai-conf-arc"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          transform="rotate(-90 14 14)"
        />
      </svg>
      <span className="ai-conf-text">
        <b>{value}%</b>
        {!compact && <small>{confidenceLabel(value)} confidence</small>}
      </span>
    </span>
  );
}

/* ---------- Explanation ---------- */

/** "Why this?" in plain words. Native details keeps it keyboard-friendly with no script. */
export function Explain({ label = 'Why this suggestion?', children }: { label?: string; children: ReactNode }) {
  return (
    <details className="ai-why">
      <summary>
        <Icon name="lightbulb" size={13} />
        {label}
      </summary>
      <div className="ai-why-body">{children}</div>
    </details>
  );
}

/* ---------- Demo actions ---------- */

type Phase = 'idle' | 'working' | 'done';

/**
 * A button that behaves like the real thing without doing it: a brief pause, a toast that says
 * plainly nothing was changed, then a done state that can be pressed again to reset.
 */
export function DemoButton({
  children,
  doneLabel = 'Marked in demo',
  message = 'Demo only: no change was made to your hotel.',
  icon,
  variant = 'default',
  size = 'sm',
  workingMs = 700,
}: {
  children: ReactNode;
  doneLabel?: string;
  message?: string;
  icon?: IconName;
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'md' | 'sm';
  workingMs?: number;
}) {
  const { toast } = useFeedback();
  const [phase, setPhase] = useState<Phase>('idle');
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const press = () => {
    if (phase === 'done') {
      setPhase('idle');
      return;
    }
    setPhase('working');
    timer.current = window.setTimeout(() => {
      setPhase('done');
      toast(message);
    }, workingMs);
  };

  return (
    <Button
      size={size}
      variant={phase === 'done' ? 'default' : variant}
      icon={phase === 'done' ? 'check' : icon}
      loading={phase === 'working'}
      className={phase === 'done' ? 'ai-done' : undefined}
      onClick={press}
      title={phase === 'done' ? 'Press again to undo in the demo' : undefined}
    >
      {phase === 'done' ? doneLabel : children}
    </Button>
  );
}

/* ---------- Insight card ---------- */

export function InsightCard({
  icon,
  title,
  body,
  confidence,
  tone = 'teal',
  eyebrow,
  explain,
  action,
  meta,
}: {
  icon: IconName;
  title: string;
  body: ReactNode;
  confidence?: number;
  tone?: 'teal' | 'gold' | 'sage' | 'blush' | 'info' | 'warn' | 'bad' | 'good';
  eyebrow?: ReactNode;
  explain?: ReactNode;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <article className="ai-card" data-tone={tone}>
      <div className="ai-card-head">
        <span className="ai-card-icon"><Icon name={icon} size={17} /></span>
        <div className="ai-card-title">
          {eyebrow && <span className="ai-eyebrow">{eyebrow}</span>}
          <h3>{title}</h3>
        </div>
        {meta}
      </div>
      <p className="ai-card-body">{body}</p>
      {explain && <Explain>{explain}</Explain>}
      {(confidence !== undefined || action) && (
        <div className="ai-card-foot">
          {confidence !== undefined ? <Confidence value={confidence} /> : <span />}
          {action}
        </div>
      )}
    </article>
  );
}

/* ---------- Layout ---------- */

export function AiGrid({ children, min = 280 }: { children: ReactNode; min?: number }) {
  return <div className="ai-grid" style={{ ['--ai-min' as string]: `${min}px` }}>{children}</div>;
}

/** A thin segmented bar for shares that add up to 100. */
export function ShareBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  return (
    <div>
      <div className="ai-share" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}%`).join(', ')}>
        {parts.map((p) => (
          <i key={p.label} style={{ width: `${p.value}%`, background: p.color }} />
        ))}
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        {parts.map((p) => (
          <span key={p.label}>
            <i className="chart-swatch" style={{ background: p.color }} />
            {p.label} <b className="strong">{p.value}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** A figure with a label and a note, used in strips under a heading. */
export function FactStrip({ facts }: { facts: { label: string; value: ReactNode; note?: ReactNode }[] }) {
  return (
    <div className="ai-facts">
      {facts.map((f) => (
        <div key={f.label} className="ai-fact">
          <span>{f.label}</span>
          <b>{f.value}</b>
          {f.note && <small>{f.note}</small>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Forecast chart ---------- */

interface ForecastTip {
  active?: boolean;
  label?: string;
  payload?: { payload: ForecastDay }[];
}

function ForecastTipBox({ active, payload }: ForecastTip) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{fmtDayMonth(d.date)}{d.note ? ` · ${d.note}` : ''}</div>
      <div className="chart-tip-row"><i className="chart-swatch" style={{ background: SERIES[0] }} /><span>Predicted</span><span>{d.predicted}%</span></div>
      <div className="chart-tip-row"><i className="chart-swatch" style={{ background: 'var(--sage)' }} /><span>Likely range</span><span>{d.low}–{d.high}%</span></div>
      <div className="chart-tip-row"><i className="chart-swatch" style={{ background: SERIES[1] }} /><span>Last year</span><span>{d.lastYear}%</span></div>
    </div>
  );
}

const tick = { fill: 'var(--ink-3)', fontSize: 12 };

/** Predicted line over a shaded likely range, with last year as a dashed comparison. */
export function ForecastChart({ data, height = 300, showLastYear = true }: { data: ForecastDay[]; height?: number; showLastYear?: boolean }) {
  const motion = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const chart = useMemo(() => data.map((d) => ({ ...d, range: [d.low, d.high] as [number, number] })), [data]);
  const summary = `Predicted occupancy for the next ${data.length} days, from ${Math.min(...data.map((d) => d.predicted))}% to ${Math.max(...data.map((d) => d.predicted))}%.`;
  return (
    <div role="img" aria-label={`${summary} Simulated.`} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chart} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="ai-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--sage)" stopOpacity={0.55} />
              <stop offset="1" stopColor="var(--sage)" stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={fmtDayMonth} minTickGap={28} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={44} domain={[20, 100]} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<ForecastTipBox />} cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 3' }} isAnimationActive={false} />
          <Area dataKey="range" name="Likely range" stroke="none" fill="url(#ai-band)" isAnimationActive={motion} animationDuration={450} activeDot={false} />
          {showLastYear && <Line dataKey="lastYear" name="Last year" stroke={SERIES[1]} strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={motion} animationDuration={450} />}
          <Line dataKey="predicted" name="Predicted" stroke={SERIES[0]} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={motion} animationDuration={450} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Two-line comparison ---------- */

export interface CompareRow {
  label: string;
  base: number;
  better: number;
}

/** A solid line over a dashed one, for "as things are" against "with the suggestions". */
export function CompareChart({
  data,
  baseName,
  betterName,
  format,
  axisFormat,
  height = 260,
  label,
}: {
  data: CompareRow[];
  baseName: string;
  betterName: string;
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  height?: number;
  label: string;
}) {
  const motion = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  return (
    <div role="img" aria-label={label} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="ai-compare" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--c1)" stopOpacity={0.28} />
              <stop offset="1" stopColor="var(--c1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={58} tickFormatter={axisFormat} domain={['dataMin - 200000', 'dataMax + 200000']} />
          <Tooltip
            cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 3' }}
            isAnimationActive={false}
            content={({ active, payload, label: l }) =>
              active && payload?.length ? (
                <div className="chart-tip">
                  <div className="chart-tip-title">{String(l)}</div>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)} className="chart-tip-row">
                      <i className="chart-swatch" style={{ background: p.color }} />
                      <span>{p.name}</span>
                      <span>{format(Number(p.value))}</span>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          <Area dataKey="better" name={betterName} stroke="var(--c1)" strokeWidth={2.5} fill="url(#ai-compare)" activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={motion} animationDuration={450} />
          <Line dataKey="base" name={baseName} stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={motion} animationDuration={450} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
