import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AI_LABEL, AI_NAV, CUSTOMERS_LABEL, NAV, PROPERTY_LABEL } from '@/app/navigation';
import { useSlidingThumb } from '@/hooks/useSlidingThumb';
import { errorMessage } from '@/lib/validation';
import { initials } from '@/lib/format';
import { HeaderWaves, StatCardArt, type StatArt } from './decor';
import { Icon, type IconName } from './icons';

/* ---------- Button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  icon?: IconName;
  block?: boolean;
  /** Shows a spinner and blocks further presses while an action is running. */
  loading?: boolean;
};

export function Button({ variant = 'default', size = 'md', icon, block, loading, disabled, className = '', children, type = 'button', ...rest }: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' && `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, ...rest }: Omit<ButtonProps, 'children' | 'icon'> & { icon: IconName; label: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon" aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

/* ---------- Form controls ---------- */

export function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

type LabelProps = { label: string; error?: string; hint?: string; wrapClass?: string };

export function TextField({ label, error, hint, wrapClass, ...rest }: LabelProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapClass}>
      {(id) => <input id={id} className="input" aria-invalid={!!error} {...rest} />}
    </Field>
  );
}

export function SelectField({ label, error, hint, wrapClass, children, ...rest }: LabelProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapClass}>
      {(id) => <select id={id} className="input" aria-invalid={!!error} {...rest}>{children}</select>}
    </Field>
  );
}

export function TextAreaField({ label, error, hint, wrapClass, ...rest }: LabelProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapClass}>
      {(id) => <textarea id={id} className="input" aria-invalid={!!error} {...rest} />}
    </Field>
  );
}

export type ComboOption = { value: string; label: string; search: string };

/** A select you can type into: filters as you type, arrow keys + Enter to pick. */
export function ComboboxField({ label, error, wrapClass, options, value, onChange, placeholder, disabled }: LabelProps & {
  options: ComboOption[]; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const digits = q.replace(/\D/g, '');
    return options.filter((o) => {
      const s = o.search.toLowerCase();
      return s.includes(q) || (digits.length > 0 && s.replace(/\D/g, '').includes(digits));
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  const pick = (o: ComboOption) => { onChange(o.value); setOpen(false); setQuery(''); };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (results[active]) pick(results[active]); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); setQuery(''); }
  };

  return (
    <Field label={label} error={error} className={wrapClass}>
      {(id) => (
        <div className="combo" ref={rootRef}>
          <input
            id={id}
            className="input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={!!error}
            autoComplete="off"
            disabled={disabled}
            placeholder={selected ? selected.label : placeholder}
            value={open ? query : selected?.label ?? ''}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={onKeyDown}
          />
          {open && (
            <ul className="combo-list" id={listId} role="listbox">
              {results.length === 0 && <li className="combo-empty">No guests match “{query}”</li>}
              {results.map((o, i) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  className={`combo-opt${i === active ? ' active' : ''}${o.value === value ? ' selected' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                >
                  {o.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}

export function SearchInput({ value, onChange, placeholder, label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return (
    <div className="search">
      <Icon name="search" />
      <input className="input" type="search" value={value} aria-label={label} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------- Badge ---------- */

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'quiet' | 'brass';

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/* ---------- Modal ---------- */

/** Open modals, newest last. Only the top one reacts to the keyboard. */
const modalStack: symbol[] = [];

/** Keep in step with the modal-out animation in app.css. */
const MODAL_EXIT_MS = 150;

/**
 * Plays the closing animation of a modal that has already unmounted. Modals are opened with
 * `{open && <Modal />}`, so nothing stays mounted to animate: an inert copy fades out instead.
 * The copy is hidden from assistive technology and takes no clicks.
 */
function playModalExit(root: HTMLElement, scrollTop: number) {
  // The public site has no exit styling, and reduced motion means no animation at all.
  if (!document.documentElement.dataset.theme || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ghost = root.cloneNode(true) as HTMLElement;
  // cloneNode copies attributes, not live values, so carry over what was on screen.
  const fields = 'input, select, textarea';
  const original = root.querySelectorAll<HTMLInputElement>(fields);
  ghost.querySelectorAll<HTMLInputElement>(fields).forEach((field, i) => {
    field.value = original[i].value;
  });
  // Nothing in the copy may pass for the real dialog.
  ghost.querySelectorAll('[role="dialog"], [id], [for], [aria-labelledby], [data-testid]').forEach((el) => {
    ['role', 'id', 'for', 'aria-labelledby', 'data-testid'].forEach((attr) => el.removeAttribute(attr));
  });
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.classList.add('modal-ghost', 'no-print');
  document.body.appendChild(ghost);
  ghost.scrollTop = scrollTop;
  window.setTimeout(() => ghost.remove(), MODAL_EXIT_MS);
}

export function Modal({ title, subtitle, onClose, size = 'md', footer, children }: { title: string; subtitle?: ReactNode; onClose: () => void; size?: 'sm' | 'md' | 'lg' | 'xl'; footer?: ReactNode; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // StrictMode's trial unmount remounts straight away, so only a modal still gone once the
  // commit has finished has really closed.
  useLayoutEffect(() => {
    const root = backdrop.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!root) return;
      const scrollTop = root.scrollTop;
      queueMicrotask(() => {
        if (!mounted.current) playModalExit(root, scrollTop);
      });
    };
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea');
    (first ?? panel.current)?.focus();
    const token = Symbol('modal');
    modalStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        closeRef.current();
      }
      if (e.key === 'Tab' && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
        if (!items.length) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div ref={backdrop} className="modal-root" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-head no-print">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <div className="panel-sub">{subtitle}</div>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot no-print">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Toasts & confirm ---------- */

interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error';
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (message: string) => void;
  toastError: (error: unknown) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Runs an action, reports its failure as a toast, and returns whether it worked. */
  run: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const counter = useRef(0);

  const push = useCallback((message: string, kind: Toast['kind']) => {
    const id = ++counter.current;
    setToasts((list) => [...list.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);

  const api = useMemo<FeedbackApi>(
    () => ({
      toast: (message) => push(message, 'success'),
      toastError: (error) => push(errorMessage(error), 'error'),
      confirm: (options) => new Promise((resolve) => setPending({ ...options, resolve })),
      run: async (action, success) => {
        try {
          await action();
          if (success) push(success, 'success');
          return true;
        } catch (error) {
          push(errorMessage(error), 'error');
          return false;
        }
      },
    }),
    [push],
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {pending && (
        <Modal
          title={pending.title}
          size="sm"
          onClose={() => settle(false)}
          footer={
            <>
              <Button onClick={() => settle(false)}>Go back</Button>
              <Button variant={pending.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
                {pending.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          <div className="muted">{pending.message}</div>
        </Modal>
      )}
      {createPortal(
        <div className="toasts no-print" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <Icon name={t.kind === 'error' ? 'alert' : 'check'} />
              <span>{t.message}</span>
              <button type="button" aria-label="Dismiss" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const api = useContext(FeedbackContext);
  if (!api) throw new Error('useFeedback must be used inside FeedbackProvider');
  return api;
}

/* ---------- Layout bits ---------- */

export function PageHead({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  const { pathname } = useLocation();
  const aiItem = AI_NAV.find((n) => n.to === pathname);
  const item = aiItem ?? NAV.find((n) => n.to === pathname);
  const isHome = pathname === '/app/dashboard';
  return (
    <header className="page-head">
      <HeaderWaves soft={!isHome} />
      <div className="page-head-main">
        {item && <span className="page-icon"><Icon name={item.icon} size={22} /></span>}
        <div className="page-head-text">
          {item && !isHome && (
            <nav className="breadcrumb no-print" aria-label="Breadcrumb">
              <Link to="/app/dashboard">Dashboard</Link>
              <Icon name="next" size={12} />
              {aiItem && (
                <>
                  <span>{AI_LABEL}</span>
                  <Icon name="next" size={12} />
                </>
              )}
              {item.inProperty && (
                <>
                  <span>{PROPERTY_LABEL}</span>
                  <Icon name="next" size={12} />
                </>
              )}
              {item.inCustomers && (
                <>
                  <span>{CUSTOMERS_LABEL}</span>
                  <Icon name="next" size={12} />
                </>
              )}
              <span aria-current="page">{item.label}</span>
            </nav>
          )}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions row">{actions}</div>}
    </header>
  );
}

export function Panel({ title, subtitle, actions, icon, children, className = '' }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div className="panel-title">
            {icon && <span className="panel-icon"><Icon name={icon} size={16} /></span>}
            <div>
              {title && <h2>{title}</h2>}
              {subtitle && <div className="panel-sub">{subtitle}</div>}
            </div>
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Metrics ---------- */

export type StatTone = 'teal' | 'sage' | 'gold' | 'blush' | 'good' | 'warn' | 'bad' | 'info' | 'quiet';

/** Decorative trend line. The card's value and note carry the same information as text. */
export function Sparkline({ values }: { values: number[] }) {
  const gradient = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(2)},${(30 - ((v - min) / range) * 26).toFixed(2)}`);
  const line = `M${points.join('L')}`;
  return (
    <svg className="sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L100,32L0,32Z`} fill={`url(#${gradient})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Decorative progress bar. Always pair it with the figures in text. */
export function Meter({ value, tone = 'teal' }: { value: number; tone?: StatTone }) {
  const width = Math.min(100, Math.max(0, value));
  return <div className="meter" data-tone={tone} aria-hidden="true"><i style={{ width: `${width}%` }} /></div>;
}

export function StatGrid({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 }) {
  return <div className="stat-grid" data-columns={columns}>{children}</div>;
}

export function StatCard({
  label,
  value,
  note,
  icon,
  tone = 'teal',
  to,
  testId,
  trend,
  spark,
  meter,
  meterTone,
  art,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon: IconName;
  tone?: StatTone;
  to?: string;
  testId?: string;
  /** Percentage change against the previous period. */
  trend?: number;
  spark?: number[];
  /** 0 to 100. */
  meter?: number;
  /** Defaults to the card's own tone. */
  meterTone?: StatTone;
  /** A quiet picture in the corner. */
  art?: StatArt;
}) {
  const body = (
    <>
      {art && <StatCardArt art={art} />}
      <div className="stat-top">
        <span className="stat-icon"><Icon name={icon} size={17} /></span>
        <span className="ledger-label">{label}</span>
        {to && <span className="stat-go"><Icon name="arrow" size={14} /></span>}
      </div>
      <div className="stat-main">
        <div className="ledger-value" data-testid={testId}>{value}</div>
        {spark && <Sparkline values={spark} />}
      </div>
      {meter !== undefined && <Meter value={meter} tone={meterTone ?? tone} />}
      {(note || trend !== undefined) && (
        <div className="ledger-note">
          {trend !== undefined && (
            <span className={`trend ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
              <Icon name={trend >= 0 ? 'trendUp' : 'trendDown'} size={13} />
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {note && <span>{note}</span>}
        </div>
      )}
    </>
  );
  return to
    ? <Link className="stat-card is-link" data-tone={tone} to={to}>{body}</Link>
    : <div className="stat-card" data-tone={tone}>{body}</div>;
}

/** A guest or team member in a table cell or list row. */
export function PersonCell({ name, sub, vip }: { name: string; sub?: ReactNode; vip?: boolean }) {
  return (
    <div className="person">
      <Avatar name={name} />
      <div className="person-text">
        <div className="cell-title">{name}{vip && <span className="badge badge-brass badge-inline">VIP</span>}</div>
        {sub && <div className="cell-sub">{sub}</div>}
      </div>
    </div>
  );
}

/** A small labelled figure for use inside dialogs. */
export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function EmptyState({ icon = 'search', title, message, action }: { icon?: IconName; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark"><Icon name={icon} size={20} /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return <span className={`avatar ${large ? 'avatar-lg' : ''}`} aria-hidden="true">{initials(name)}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void }) {
  const { containerRef, thumbRef } = useSlidingThumb<HTMLDivElement>(".tab[aria-selected='true']", `${value}|${tabs.map((t) => t.count).join()}`);
  return (
    <div ref={containerRef} className="tabs" role="tablist">
      <span ref={thumbRef} className="tab-thumb" aria-hidden="true" />
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" className="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="stack page-loading" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 52, width: 300 }} />
      <div className="stat-grid" data-columns={4}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 118 }} />)}
      </div>
      <div className="skeleton" style={{ height: 340 }} />
    </div>
  );
}

/* ---------- Data table ---------- */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sort?: (row: T) => string | number;
  num?: boolean;
  primary?: boolean;
  actions?: boolean;
  hideOnMobile?: boolean;
}

/** Page numbers to show, with null where a run is skipped: 1 … 4 5 6 … 12. */
function pageWindow(current: number, pages: number): (number | null)[] {
  const wanted = new Set([0, pages - 1, current - 1, current, current + 1]);
  const list = [...wanted].filter((p) => p >= 0 && p < pages).sort((a, b) => a - b);
  return list.flatMap((p, i) => (i > 0 && p - list[i - 1] > 1 ? [null, p] : [p]));
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  pageSize = 12,
  caption,
  defaultSort,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  pageSize?: number;
  caption: string;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!column?.sort) return rows;
    const get = column.sort;
    const factor = sort!.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * factor;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);

  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  return (
    <>
      <div className="table-wrap">
        <table className="table table-responsive">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.num ? 'num' : undefined}
                  data-hide-mobile={c.hideOnMobile ? '' : undefined}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSort((s) => (s?.key === c.key && s.dir === 'asc' ? { key: c.key, dir: 'desc' } : { key: c.key, dir: 'asc' }));
                        setPage(0);
                      }}
                    >
                      {c.header}
                      <span className={`sort-mark ${sort?.key === c.key ? 'on' : ''}`}>
                        <Icon name={sort?.key === c.key ? (sort.dir === 'asc' ? 'up' : 'down') : 'sort'} size={12} />
                      </span>
                    </button>
                  ) : c.actions ? (
                    <span className="sr-only">{c.header}</span>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)} className={onRowClick ? 'clickable' : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={c.num ? 'num' : undefined}
                    data-label={c.header}
                    data-primary={c.primary ? '' : undefined}
                    data-actions={c.actions ? '' : undefined}
                    data-hide-mobile={c.hideOnMobile ? '' : undefined}
                    onClick={c.actions ? (e) => e.stopPropagation() : undefined}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>
          {pages > 1 && <>Showing {current * pageSize + 1}–{Math.min((current + 1) * pageSize, sorted.length)} of </>}
          {sorted.length} {sorted.length === 1 ? 'record' : 'records'}
        </span>
        {pages > 1 && (
          <nav className="pager" aria-label={`${caption} pages`}>
            <Button size="sm" icon="prev" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page" />
            {pageWindow(current, pages).map((p, i) =>
              p === null ? (
                <span key={`gap${i}`} className="pager-gap" aria-hidden="true">…</span>
              ) : (
                <button key={p} type="button" className="pager-num" aria-label={`Page ${p + 1}`} aria-current={p === current ? 'page' : undefined} onClick={() => setPage(p)}>
                  {p + 1}
                </button>
              ),
            )}
            <Button size="sm" icon="next" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page" />
          </nav>
        )}
      </div>
    </>
  );
}
