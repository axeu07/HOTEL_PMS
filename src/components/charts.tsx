import { useId, useMemo, type ReactElement, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Chart colours are validated tokens (see global.css), in fixed series order. */
export const SERIES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

const axisTick = { fill: 'var(--ink-3)', fontSize: 12 };
const ANIMATION_MS = 450;

/** The champagne marker over the current day. Recharts hands it the plot area to sit on. */
function TodayPill({ viewBox }: { viewBox?: { x: number; y: number } }) {
  if (!viewBox) return null;
  const width = 50;
  const height = 22;
  return (
    <g transform={`translate(${viewBox.x - width / 2} ${viewBox.y - height - 2})`}>
      <rect width={width} height={height} rx={height / 2} fill="var(--gold)" />
      <text x={width / 2} y={15} textAnchor="middle" fill="var(--on-gold)" fontSize={11.5} fontWeight={600}>Today</text>
    </g>
  );
}

/** Charts draw in JavaScript, so the CSS reduced-motion rule does not reach them. */
function useChartMotion() {
  return useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
}

interface TipPayload {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
}

function Tip({ active, payload, label, format, labelFormat }: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string;
  format: (v: number) => string;
  labelFormat?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{labelFormat && label ? labelFormat(label) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="chart-tip-row">
          <i className="chart-swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span>{format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

function Figure({ label, height, children }: { label: string; height: number; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

export function TrendArea<T extends object>({
  data,
  xKey,
  series,
  format,
  axisFormat,
  xFormat,
  height = 250,
  label,
  yMax,
}: {
  data: T[];
  xKey: keyof T & string;
  series: SeriesDef;
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  xFormat: (v: string) => string;
  height?: number;
  label: string;
  yMax?: number;
}) {
  const fillId = useId().replace(/:/g, '');
  const motion = useChartMotion();
  // A fresher tint of the line, so the fill reads as colour rather than grey at low opacity.
  const fillColor = `color-mix(in srgb, ${series.color} 55%, var(--area-lift))`;
  return (
    <Figure label={label} height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={fillColor} stopOpacity={0.5} />
            <stop offset="0.65" stopColor={fillColor} stopOpacity={0.18} />
            <stop offset="1" stopColor={fillColor} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={xFormat} minTickGap={36} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={axisFormat} width={58} domain={yMax ? [0, yMax] : undefined} />
        <Tooltip
          content={<Tip format={format} labelFormat={xFormat} />}
          cursor={{ stroke: 'var(--ink-3)', strokeWidth: 1, strokeDasharray: '3 3' }}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey={series.key}
          name={series.name}
          stroke={series.color}
          strokeWidth={2.25}
          fill={`url(#${fillId})`}
          activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
          isAnimationActive={motion}
          animationDuration={ANIMATION_MS}
          animationEasing="ease-out"
        />
      </AreaChart>
    </Figure>
  );
}

export function Bars<T extends object>({
  data,
  xKey,
  series,
  stacked,
  format,
  axisFormat,
  xFormat,
  height = 250,
  label,
  yMax,
  highlightX,
}: {
  data: T[];
  xKey: keyof T & string;
  series: SeriesDef[];
  stacked?: boolean;
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  xFormat?: (v: string) => string;
  height?: number;
  label: string;
  yMax?: number;
  highlightX?: string;
}) {
  const motion = useChartMotion();
  const fillId = useId().replace(/:/g, '');
  // A lone series is drawn as gradient columns. Stacks and groups keep flat fills so their colours can be told apart.
  const single = series.length === 1;
  return (
    <Figure label={label} height={height}>
      <BarChart data={data} margin={{ top: highlightX ? 28 : 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
        {single && (
          <defs>
            <linearGradient id={`${fillId}past`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--bar-now)" stopOpacity={0.95} />
              <stop offset="1" stopColor="var(--bar-now)" stopOpacity={0.38} />
            </linearGradient>
            <linearGradient id={`${fillId}ahead`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--bar-ahead)" stopOpacity={0.95} />
              <stop offset="1" stopColor="var(--bar-ahead)" stopOpacity={0.3} />
            </linearGradient>
          </defs>
        )}
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={xFormat} minTickGap={22} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={axisFormat} width={58} domain={yMax ? [0, yMax] : undefined} allowDecimals={false} />
        <Tooltip content={<Tip format={format} labelFormat={xFormat} />} cursor={{ fill: 'var(--surface-3)', opacity: 0.45, radius: 6 }} isAnimationActive={false} />
        {highlightX && <ReferenceLine x={highlightX} stroke="var(--gold)" strokeDasharray="3 3" ifOverflow="visible" label={<TodayPill />} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            stackId={stacked ? 'a' : undefined}
            maxBarSize={24}
            stroke="var(--surface)"
            strokeWidth={stacked ? 1 : 0}
            radius={!stacked || i === series.length - 1 ? [5, 5, 0, 0] : 0}
            isAnimationActive={motion}
            animationDuration={ANIMATION_MS}
            animationEasing="ease-out"
          >
            {single && data.map((row) => (
              <Cell key={String(row[xKey])} fill={`url(#${fillId}${highlightX && String(row[xKey]) > highlightX ? 'ahead' : 'past'})`} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </Figure>
  );
}

/** Ranked horizontal bars, better than a donut for comparing close values. */
export function RankedBars({ rows, format }: { rows: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="ranked">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="row-between small">
            <span>{row.label}</span>
            <span className="strong">{format(row.value)}</span>
          </div>
          <div className="meter" data-tone="teal" aria-hidden="true">
            <i style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Legend({ series }: { series: SeriesDef[] }) {
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.key}>
          <i className="chart-swatch" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}
