import { TrendArea, SERIES } from '@/components/charts';
import { Icon } from '@/components/icons';
import { Badge, PageHead, Panel, StatCard, StatGrid } from '@/components/ui';
import { COMPLAINTS, PRAISE, REVIEW_SUMMARY, REVIEW_TREND, type Theme } from '@/data/aiInsights';
import { DemoButton, ShareBar, SimTag } from '@/features/ai/AiParts';

function ThemeRow({ theme, max, withAction }: { theme: Theme; max: number; withAction?: boolean }) {
  const negative = theme.sentiment === 'negative';
  // For complaints, more mentions is worse; for praise it is better.
  const up = theme.change > 0;
  const worse = negative ? up : !up;
  return (
    <li className="ai-theme">
      <div className="row-between" style={{ gap: 10 }}>
        <span className="cell-title">{theme.topic}</span>
        <span className="row" style={{ gap: 8 }}>
          <span className="small muted">{theme.mentions} mentions</span>
          <Badge tone={worse ? 'bad' : 'good'}>{up ? '+' : ''}{theme.change}%</Badge>
        </span>
      </div>
      <div className="meter" data-tone={negative ? 'blush' : 'teal'} aria-hidden="true"><i style={{ width: `${(theme.mentions / max) * 100}%` }} /></div>
      <blockquote>“{theme.quote}”</blockquote>
      {withAction && theme.suggestion && (
        <div className="ai-theme-action">
          <span><Icon name="lightbulb" size={14} /> {theme.suggestion}</span>
          <DemoButton doneLabel="Task drafted (demo)" message="Demo only: no task was created for your team.">Create task</DemoButton>
        </div>
      )}
    </li>
  );
}

export default function ReviewIntelligence() {
  const s = REVIEW_SUMMARY;
  const maxStars = Math.max(...s.distribution.map((d) => d.count));
  const maxComplaint = Math.max(...COMPLAINTS.map((c) => c.mentions));
  const maxPraise = Math.max(...PRAISE.map((c) => c.mentions));

  return (
    <>
      <PageHead title="Review Intelligence" />
      <StatGrid>
        <StatCard icon="star" tone="gold" label="Average rating" value={s.rating.toFixed(1)} trend={2.2} note="out of 5, last 90 days" meter={(s.rating / 5) * 100} />
        <StatCard icon="message" label="Reviews analysed" value={s.count.toLocaleString('en-IN')} note="Across all sources" />
        <StatCard icon="thumbUp" tone="sage" label="Positive sentiment" value={`${s.sentiment.positive}%`} trend={2.1} note="vs previous quarter" meter={s.sentiment.positive} />
        <StatCard icon="mail" tone="info" label="Response rate" value={`${s.responseRate}%`} note="Replied to within 2 days" meter={s.responseRate} />
      </StatGrid>

      <div className="grid-1-1">
        <Panel icon="activity" title="Sentiment breakdown" actions={<SimTag />}>
          <div className="panel-body">
            <ShareBar
              parts={[
                { label: 'Positive', value: s.sentiment.positive, color: 'var(--c1)' },
                { label: 'Neutral', value: s.sentiment.neutral, color: 'var(--champagne)' },
                { label: 'Negative', value: s.sentiment.negative, color: 'var(--coral-deep)' },
              ]}
            />
            <ul className="ai-stars" aria-label="Rating distribution">
              {s.distribution.map((d) => (
                <li key={d.stars}>
                  <span className="ai-stars-label">{d.stars} <Icon name="star" size={12} /></span>
                  <div className="meter" data-tone="gold" aria-hidden="true"><i style={{ width: `${(d.count / maxStars) * 100}%` }} /></div>
                  <span className="small muted">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel icon="trendUp" title="Positive sentiment, last 12 weeks" actions={<SimTag />}>
          <div className="panel-body">
            <TrendArea
              data={REVIEW_TREND}
              xKey="week"
              series={{ key: 'positive', name: 'Positive reviews', color: SERIES[0] }}
              format={(v) => `${v}%`}
              axisFormat={(v) => `${v}%`}
              xFormat={(v) => v}
              yMax={100}
              height={240}
              label="Positive sentiment rose from about 72% to 78% over twelve weeks."
            />
          </div>
        </Panel>
      </div>

      <div className="grid-1-1 section-gap">
        <Panel icon="thumbDown" title="Recurring complaints" actions={<SimTag />}>
          <ul className="ai-themes">
            {COMPLAINTS.map((c) => <ThemeRow key={c.id} theme={c} max={maxComplaint} withAction />)}
          </ul>
        </Panel>
        <Panel icon="thumbUp" title="What guests love" actions={<SimTag />}>
          <ul className="ai-themes">
            {PRAISE.map((p) => <ThemeRow key={p.id} theme={p} max={maxPraise} />)}
          </ul>
          <div className="panel-body">
          </div>
        </Panel>
      </div>
    </>
  );
}
