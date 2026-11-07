import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PRIORITY } from '@/app/labels';
import { useAuth } from '@/app/providers';
import { Icon, type IconName } from '@/components/icons';
import { Badge, Button, EmptyState, PageHead, PageLoading, Panel, Tabs, useFeedback } from '@/components/ui';
import { GuestExperience } from '@/features/GuestExperience';
import { useNow } from '@/hooks/useNow';
import { useResource } from '@/hooks/useResource';
import {
  ACTION_CATEGORIES,
  ACTION_KINDS,
  deriveQuickActions,
  matchesFocus,
  quickActionService,
  staffService,
  UNTRACKED_ACTIONS,
  type ActionCategory,
  type QuickAction,
} from '@/services';

type Status = 'all' | 'urgent' | 'pending' | 'resolved';

const STATUSES: { id: Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
];

const CATEGORY_ICON: Record<ActionCategory, IconName> = {
  housekeeping: 'broom',
  staff: 'badge',
  'front-desk': 'concierge',
  maintenance: 'wrench',
  finance: 'receipt',
  'guest-experience': 'star',
};

const FOCUS_LABEL: Record<string, string> = {
  'rooms-to-clean': 'Rooms to clean',
  ...Object.fromEntries(ACTION_KINDS.map((k) => [k.id, k.label])),
};

/** Longer lists fold, so one busy kind cannot push the rest of the page out of reach. */
const FOLDED_ROWS = 5;

const inStatus = (action: QuickAction, status: Status) =>
  status === 'all' ||
  (status === 'resolved' && action.resolved) ||
  (status === 'urgent' && !action.resolved && action.priority === 'high') ||
  (status === 'pending' && !action.resolved && action.priority !== 'high');

function ActionRow({ action }: { action: QuickAction }) {
  const { run } = useFeedback();
  return (
    <li className="qa-item" data-resolved={action.resolved || undefined} data-priority={action.priority} data-testid={`qa-item-${action.id}`}>
      <div className="qa-item-main">
        <div className="qa-item-title">
          <Link to={action.to}>{action.title}</Link>
          {action.vip && <span className="badge badge-brass">VIP</span>}
        </div>
        {action.details.length > 0 && <div className="cell-sub qa-item-details">{action.details.join(' · ')}</div>}
      </div>
      <div className="qa-item-meta">
        <Badge tone={action.status.tone}>{action.status.label}</Badge>
        {!action.resolved && <Badge tone={PRIORITY[action.priority].tone}>{PRIORITY[action.priority].label}</Badge>}
        <span className="qa-item-when">{action.when}</span>
      </div>
      <div className="qa-item-actions">
        {action.command?.type === 'mark-arrived' && (
          <Button size="sm" variant="primary" icon="check" onClick={() => run(() => staffService.markArrived(action.command!.id), `${action.title} marked as arrived`)}>Mark arrived</Button>
        )}
        {action.command?.type === 'review-late' && (
          <Button size="sm" icon="check" onClick={() => run(() => staffService.reviewLate(action.command!.id), 'Late arrival noted')}>Acknowledge</Button>
        )}
        <Link className="btn btn-sm" to={action.to} aria-label={`Open ${action.title}`}>Open</Link>
      </div>
    </li>
  );
}

function KindGroup({ kindId, actions, unfolded }: { kindId: string; actions: QuickAction[]; unfolded: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const kind = ACTION_KINDS.find((k) => k.id === kindId)!;
  const open = actions.filter((a) => !a.resolved).length;
  const visible = unfolded || showAll ? actions : actions.slice(0, FOLDED_ROWS);
  return (
    <div className="qa-group">
      <div className="qa-group-head">
        <h3>{kind.label}</h3>
        <span className="count" data-testid={`qa-group-count-${kind.id}`}>{open}</span>
        <span className="cell-sub">{kind.hint}</span>
      </div>
      <ul className="qa-list">
        {visible.map((action) => <ActionRow key={action.id} action={action} />)}
      </ul>
      {!unfolded && actions.length > FOLDED_ROWS && (
        <button type="button" className="link-btn small qa-more" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer' : `Show all ${actions.length}`}
        </button>
      )}
    </div>
  );
}

export default function QuickActions() {
  const { role } = useAuth();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const { data } = useResource(() => quickActionService.load());

  // A category only appears if this role can also open the module its records live in.
  const permissions = role?.permissions;
  const categories = useMemo(() => ACTION_CATEGORIES.filter((c) => permissions?.includes(c.permission)), [permissions]);
  const actions = useMemo(() => {
    if (!data) return [];
    const allowed = new Set(categories.map((c) => c.id));
    return deriveQuickActions(data, now).filter((a) => allowed.has(a.category));
  }, [data, now, categories]);

  if (!data) return <PageLoading />;

  const requested = params.get('category') as ActionCategory | null;
  const category = categories.some((c) => c.id === requested) ? requested : null;
  const focus = params.get('focus') && FOCUS_LABEL[params.get('focus')!] ? params.get('focus') : null;
  const status: Status = STATUSES.some((s) => s.id === params.get('status')) ? (params.get('status') as Status) : 'all';

  const setFilters = (next: { category?: string | null; focus?: string | null; status?: Status }) => {
    const merged = { category, focus, status, ...next };
    const out: Record<string, string> = {};
    if (merged.category) out.category = merged.category;
    if (merged.focus) out.focus = merged.focus;
    if (merged.status !== 'all') out.status = merged.status;
    setParams(out, { replace: true });
  };

  const inFocus = (a: QuickAction) => !focus || matchesFocus(a, focus);
  const scoped = actions.filter((a) => (!category || a.category === category) && inFocus(a));
  const visible = scoped.filter((a) => inStatus(a, status));
  const openCount = scoped.filter((a) => !a.resolved).length;
  const allOpen = actions.filter((a) => !a.resolved);
  const shownCategories = categories.filter((c) => !category || c.id === category);
  const untracked = UNTRACKED_ACTIONS.filter((u) => shownCategories.some((c) => c.id === u.category));
  const reviewsView = category === 'guest-experience';
  const allClear = openCount === 0 && status !== 'resolved';

  return (
    <>
      <PageHead
        title="Quick Actions"
        subtitle={`${allOpen.length} open · ${allOpen.filter((a) => a.priority === 'high').length} urgent · ${actions.length - allOpen.length} resolved today`}
      />

      <Panel className="qa-filters">
        <div className="qa-tabs">
          <Tabs
            value={category ?? 'all'}
            onChange={(id) => setFilters({ category: id === 'all' ? null : id, focus: null })}
            tabs={[
              { id: 'all', label: 'All categories', count: allOpen.length },
              ...categories.map((c) => ({ id: c.id, label: c.label, count: c.id === 'guest-experience' ? undefined : allOpen.filter((a) => a.category === c.id).length })),
            ]}
          />
        </div>
        {!reviewsView && <div className="toolbar qa-toolbar">
          <div className="segmented" role="group" aria-label="Filter by status">
            {STATUSES.map((s) => (
              <button key={s.id} type="button" aria-pressed={status === s.id} onClick={() => setFilters({ status: s.id })}>
                {s.label} <span className="qa-seg-count" data-testid={`qa-status-count-${s.id}`}>{scoped.filter((a) => inStatus(a, s.id)).length}</span>
              </button>
            ))}
          </div>
          {focus && (
            <button type="button" className="qa-chip" aria-label={`Clear filter: ${FOCUS_LABEL[focus]}`} onClick={() => setFilters({ focus: null })}>
              {FOCUS_LABEL[focus]} <Icon name="x" size={13} />
            </button>
          )}
        </div>}
      </Panel>

      {reviewsView && <GuestExperience />}

      {!reviewsView && <>
      {allClear && (
        <Panel className="qa-all-clear">
          <EmptyState
            icon="checks"
            title={focus || category ? 'Nothing waiting here' : 'Everything is taken care of'}
            message={status === 'urgent' || status === 'pending' || scoped.length === 0 ? 'No open items need anyone right now. New ones appear here as soon as they come up.' : 'Every open item here is finished. What was resolved today is listed below.'}
          />
        </Panel>
      )}
      {!allClear && visible.length === 0 && (
        <Panel>
          <EmptyState
            icon={status === 'resolved' ? 'clock' : 'check'}
            title={status === 'urgent' ? 'Nothing urgent right now' : status === 'pending' ? 'Nothing else pending' : 'Nothing resolved yet today'}
            message={status === 'resolved' ? 'Items finished today will collect here.' : 'The remaining items are under the other filters.'}
          />
        </Panel>
      )}

      {shownCategories.map((c) => {
        const inCategory = visible.filter((a) => a.category === c.id);
        if (inCategory.length === 0) return null;
        const open = inCategory.filter((a) => !a.resolved).length;
        return (
          <Panel key={c.id} className="qa-category" icon={CATEGORY_ICON[c.id]} title={c.label} subtitle={status === 'resolved' ? `${inCategory.length} resolved today` : `${open} open`}>
            {ACTION_KINDS.filter((k) => k.category === c.id).map((k) => {
              const rows = inCategory.filter((a) => a.kind === k.id);
              return rows.length > 0 ? <KindGroup key={k.id} kindId={k.id} actions={rows} unfolded={!!focus} /> : null;
            })}
          </Panel>
        );
      })}

      {untracked.length > 0 && (
        <p className="small muted qa-untracked">
          <Icon name="info" size={14} />
          <span>Not tracked yet: {untracked.map((u) => u.label).join(', ')}. The system holds no records of these, so no alerts are raised for them.</span>
        </p>
      )}
      </>}
    </>
  );
}
