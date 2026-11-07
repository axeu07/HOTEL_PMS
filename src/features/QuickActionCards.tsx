import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/components/icons';
import { useResource } from '@/hooks/useResource';
import { useNow } from '@/hooks/useNow';
import { summarizeReviews } from '@/domain/reviews';
import { priorityActions, quickActionService, reviewService, type PriorityCard, type PriorityKey } from '@/services';
import type { Lookups } from './useLookups';

const CARD_ICON: Record<PriorityKey, IconName> = {
  'rooms-to-clean': 'broom',
  absent: 'userAbsent',
  'overdue-checkout': 'logout',
  'unchecked-room': 'key',
};

/** Colour is never the only signal: each state also has its own label. */
const URGENCY: Record<PriorityCard['urgency'], { label: string; tone: string }> = {
  urgent: { label: 'Urgent', tone: 'bad' },
  attention: { label: 'Attention', tone: 'warn' },
  clear: { label: 'All clear', tone: 'good' },
};

function Card({ card }: { card: PriorityCard }) {
  const urgency = URGENCY[card.urgency];
  return (
    <Link className="stat-card is-link qa-card" data-tone={urgency.tone} data-testid={`qa-card-${card.key}`} to={card.to}>
      <div className="qa-card-top">
        <span className="stat-icon"><Icon name={CARD_ICON[card.key]} size={16} /></span>
        <span className="qa-urgency"><i aria-hidden="true" />{urgency.label}</span>
      </div>
      <div className="qa-card-main">
        <span className="qa-card-title">{card.title}</span>
        <span className="qa-card-count" data-testid={`qa-count-${card.key}`}>{card.count}</span>
      </div>
      <p className="qa-card-note">{card.description}</p>
    </Link>
  );
}

/** Average of all guest reviews; the full breakdown lives under Quick Actions → Guest Experience. */
function GuestExperienceCard() {
  const { data: reviews } = useResource(() => reviewService.list());
  if (!reviews) return <div className="skeleton qa-skeleton" />;
  const { average, count } = summarizeReviews(reviews);
  const tone = average === null ? { label: 'No reviews', tone: 'warn' } : average >= 4 ? { label: 'Great', tone: 'good' } : average >= 3 ? { label: 'Fair', tone: 'warn' } : { label: 'Poor', tone: 'bad' };
  return (
    <Link className="stat-card is-link qa-card" data-tone={tone.tone} data-testid="qa-card-guest-experience" to="/app/quick-actions?category=guest-experience">
      <div className="qa-card-top">
        <span className="stat-icon"><Icon name="star" size={16} /></span>
        <span className="qa-urgency"><i aria-hidden="true" />{tone.label}</span>
      </div>
      <div className="qa-card-main">
        <span className="qa-card-title">Guest Experience</span>
        <span className="qa-card-count" data-testid="qa-count-guest-experience">{average === null ? '–' : average.toFixed(1)}</span>
      </div>
      <p className="qa-card-note">{count ? `Average of ${count} review${count === 1 ? '' : 's'}` : 'No guest reviews yet'}</p>
    </Link>
  );
}

/** The things most likely to need the manager this minute, above the KPIs. */
export function QuickActionCards({ lookups }: { lookups: Lookups }) {
  const now = useNow();
  const { data } = useResource(() => quickActionService.rosterSources());
  const cards = data && priorityActions({ ...data, rooms: lookups.rooms, reservations: lookups.reservations }, now);

  return (
    <section className="qa-section" aria-labelledby="qa-heading">
      <div className="qa-section-head">
        <h2 id="qa-heading">Quick Actions</h2>
        <Link className="qa-view-all" to="/app/quick-actions">View All <Icon name="arrow" size={14} /></Link>
      </div>
      <div className="qa-grid">
        {cards ? cards.map((card) => <Card key={card.key} card={card} />) : [0, 1, 2, 3].map((i) => <div key={i} className="skeleton qa-skeleton" />)}
        <GuestExperienceCard />
      </div>
    </section>
  );
}
