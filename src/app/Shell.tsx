import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { BrandMark, Icon } from '@/components/icons';
import { SidebarScenery } from '@/components/decor';
import { Avatar, Button, Modal, useFeedback } from '@/components/ui';
import { useResource } from '@/hooks/useResource';
import { useSlidingThumb } from '@/hooks/useSlidingThumb';
import { today } from '@/lib/dates';
import { fmtDate, timeAgo } from '@/lib/format';
import {
  activityService,
  authService,
  demoService,
  guestName,
  guestService,
  leadService,
  reservationService,
  roomService,
} from '@/services';
import { NewBadge } from '@/features/ai/NewBadge';
import { AiAsk } from '@/features/ai/AiAsk';
import { FloatingAssistant } from '@/features/assistant/FloatingAssistant';
import { CursorLight } from './interaction';
import { AI_ANY_OF, AI_HOME, AI_LABEL, AI_NAV, CUSTOMERS_LABEL, NAV, PROPERTY_LABEL, type NavItem } from './navigation';
import { useApp, useAuth, useProductTheme } from './providers';

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onOutside]);
  return ref;
}

/** Keep in step with the pop-out animation in interaction.css. */
const POP_EXIT_MS = 120;

/** Lets a `{open && ...}` dropdown stay mounted long enough to play its closing animation. */
function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), POP_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);
  return { show: open || mounted, closing: !open && mounted };
}

/* ---------- Global search ---------- */

interface SearchHit {
  group: string;
  title: string;
  sub: string;
  to: string;
}

function GlobalSearch() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = useMemo(() => () => setOpen(false), []);
  const ref = useClickOutside(close);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useResource(async () => {
    const [guests, reservations, rooms, leads] = await Promise.all([guestService.list(), reservationService.list(), roomService.list(), leadService.list()]);
    return { guests, reservations, rooms, leads };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!data || q.length < 2) return [];
    const out: SearchHit[] = [];
    const guestById = new Map(data.guests.map((g) => [g.id, g]));
    if (can('guests.view')) {
      data.guests
        .filter((g) => `${g.firstName} ${g.lastName} ${g.email} ${g.phone}`.toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((g) => out.push({ group: 'Guests', title: guestName(g), sub: g.email, to: `/app/guests?open=${g.id}` }));
    }
    if (can('customers.view')) {
      data.leads
        .filter((l) => `${l.name} ${l.email} ${l.phone}`.toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((l) => out.push({ group: 'Leads', title: l.name, sub: `${l.sourceDetail} · ${l.status.replace('_', ' ')}`, to: `/app/customers/leads?open=${l.id}` }));
    }
    if (can('reservations.view')) {
      data.reservations
        .filter((r) => `${r.code} ${guestName(guestById.get(r.guestId))}`.toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((r) =>
          out.push({
            group: 'Reservations',
            title: `${r.code} · ${guestName(guestById.get(r.guestId))}`,
            sub: `${fmtDate(r.checkIn)} to ${fmtDate(r.checkOut)}`,
            to: `/app/reservations?open=${r.id}`,
          }),
        );
    }
    if (can('rooms.view')) {
      data.rooms
        .filter((r) => r.number.includes(q))
        .slice(0, 5)
        .forEach((r) => out.push({ group: 'Rooms', title: `Room ${r.number}`, sub: `Floor ${r.floor}`, to: `/app/rooms?open=${r.id}` }));
    }
    return out;
  }, [data, query, can]);

  const results = usePresence(open && query.trim().length >= 2);

  const go = (hit: SearchHit) => {
    setQuery('');
    setOpen(false);
    navigate(hit.to);
  };

  return (
    <div className="search" ref={ref}>
      <Icon name="search" />
      <input
        ref={inputRef}
        className="input"
        type="search"
        aria-label="Search guests, leads, bookings and rooms"
        placeholder="Search guests, leads, bookings…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && hits[active]) {
            go(hits[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      <kbd className="search-kbd" aria-hidden="true">Ctrl K</kbd>
      {results.show && (
        <div className={`search-results ${results.closing ? 'closing' : ''}`}>
          {hits.length === 0 && !results.closing && <div className="pop-item muted">No matches for “{query}”.</div>}
          {hits.map((hit, i) => (
            <div key={hit.to}>
              {(i === 0 || hits[i - 1].group !== hit.group) && <div className="search-group">{hit.group}</div>}
              <button type="button" className={`pop-item ${i === active ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => go(hit)}>
                <span className="grow">
                  <span className="cell-title">{hit.title}</span>
                  <span className="cell-sub" style={{ display: 'block' }}>{hit.sub}</span>
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Notifications ---------- */

function Notifications() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const close = useMemo(() => () => setOpen(false), []);
  const ref = useClickOutside(close);
  const { data } = useResource(() => activityService.list());
  const items = data ?? [];
  const unread = items.filter((i) => !i.read).length;
  const presence = usePresence(open);

  // Notifications can point anywhere; a role without that module gets the dashboard.
  const allowed = (link: string) => {
    const nav = NAV.find((n) => link.startsWith(n.to));
    return !nav?.anyOf || nav.anyOf.some(can);
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button type="button" className="btn btn-ghost btn-icon bell-btn" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" size={18} />
        {unread > 0 && <span key={unread} className="bell-count">{unread}</span>}
      </button>
      {presence.show && (
        <div className={`popover ${presence.closing ? 'closing' : ''}`}>
          <div className="popover-head">
            <span className="strong">Notifications</span>
            <button type="button" className="link-btn small" disabled={!unread} onClick={() => activityService.markAllRead()}>
              Mark all read
            </button>
          </div>
          <div className="popover-list">
            {items.length === 0 && <div className="pop-item muted">You are all caught up.</div>}
            {items.slice(0, 25).map((item) => (
              <button
                key={item.id}
                type="button"
                className="pop-item"
                onClick={() => {
                  activityService.markRead(item.id);
                  setOpen(false);
                  navigate(allowed(item.link) ? item.link : '/app/dashboard');
                }}
              >
                <span className={`dot ${item.read ? '' : 'dot-unread'}`} />
                <span className="grow">
                  <span style={{ display: 'block' }}>{item.message}</span>
                  <span className="cell-sub">{timeAgo(item.at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Account menu ---------- */

function AccountMenu({ onReset, onSwitch }: { onReset: () => void; onSwitch: () => void }) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = useMemo(() => () => setOpen(false), []);
  const ref = useClickOutside(close);
  const presence = usePresence(open);
  if (!user) return null;
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button type="button" className="user-chip" aria-expanded={open} aria-label={`Account menu for ${user.name}`} onClick={() => setOpen((o) => !o)}>
        <Avatar name={user.name} />
        <span className="who">
          <b className="strong">{user.name}</b>
          <span>{role?.name}</span>
        </span>
        <span className="user-chevron"><Icon name="chevronDown" size={16} /></span>
      </button>
      {presence.show && (
        <div className={`popover ${presence.closing ? 'closing' : ''}`} style={{ width: 250 }}>
          {/* The chip above shrinks to just the avatar on phones, so the name appears here instead. */}
          <div className="account-head">
            <Avatar name={user.name} />
            <span>
              <b className="strong">{user.name}</b>
              <span>{role?.name}</span>
            </span>
          </div>
          <button type="button" className="pop-item" onClick={() => { setOpen(false); onSwitch(); }}>
            <Icon name="users" /> Switch demo role
          </button>
          <button type="button" className="pop-item" onClick={() => { setOpen(false); navigate('/app/settings'); }}>
            <Icon name="gear" /> Hotel settings
          </button>
          <button type="button" className="pop-item" onClick={() => { setOpen(false); navigate('/app/settings?tab=preferences'); }}>
            <Icon name="sliders" /> Preferences
          </button>
          <button type="button" className="pop-item" onClick={() => { setOpen(false); navigate('/app/settings?tab=account'); }}>
            <Icon name="shield" /> Account & security
          </button>
          <Link to="/" className="pop-item" onClick={() => setOpen(false)}>
            <Icon name="globe" /> Hotel website
          </Link>
          <button type="button" className="pop-item" onClick={() => { setOpen(false); onReset(); }}>
            <Icon name="refresh" /> Reset demo data
          </button>
          <button
            type="button"
            className="pop-item"
            onClick={() => {
              signOut();
              navigate('/login');
            }}
          >
            <Icon name="logout" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function SwitchRoleModal({ onClose }: { onClose: () => void }) {
  const { user, signInAs } = useAuth();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const { data } = useResource(async () => {
    const [users, roles] = await Promise.all([authService.demoAccounts(), authService.roles()]);
    return users.map((u) => ({ user: u, role: roles.find((r) => r.id === u.roleId) }));
  });
  return (
    <Modal title="Switch demo role" subtitle="See the same hotel through another team's eyes." onClose={onClose}>
      <div className="stack-sm">
        {data?.map(({ user: account, role }) => (
          <button
            key={account.id}
            type="button"
            className="pop-item role-option"
            disabled={account.id === user?.id}
            onClick={async () => {
              await signInAs(account.id);
              toast(`Now signed in as ${role?.name}`);
              onClose();
              navigate('/app/dashboard');
            }}
          >
            <Avatar name={account.name} />
            <span className="grow">
              <span className="strong" style={{ display: 'block' }}>{role?.name}{account.id === user?.id ? ' (current)' : ''}</span>
              <span className="cell-sub">{account.name} · {role?.description}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- Sidebar ---------- */

const COLLAPSE_KEY = 'folio.demo.sidebar';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink to={item.to} className="nav-link" title={collapsed ? item.label : undefined}>
      <span className="nav-icon" data-icon={item.icon}><Icon name={item.icon} size={18} /></span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  );
}

/** A real row in the sidebar that opens onto its pages, shown as a compact segmented control. */
function GroupNav({ id, label, icon, items, collapsed, pathname, open, onToggle }: { id: string; label: string; icon: NavItem['icon']; items: NavItem[]; collapsed: boolean; pathname: string; open: boolean; onToggle: () => void }) {
  const inside = items.some((i) => i.to === pathname);
  const { containerRef, thumbRef } = useSlidingThumb<HTMLDivElement>('.nav-seg-btn.active', `${pathname}|${items.length}`);
  return (
    <div className={`nav-group ${open ? 'open' : ''}`}>
      <button
        type="button"
        className={`nav-link nav-group-toggle ${inside ? 'active' : ''}`}
        aria-expanded={open}
        aria-controls={`nav-${id}`}
        title={collapsed ? label : undefined}
        onClick={onToggle}
      >
        <span className="nav-icon" data-icon={icon}><Icon name={icon} size={18} /></span>
        <span className="nav-label">{label}</span>
        <span className="nav-chevron"><Icon name="next" size={14} /></span>
      </button>
      <div id={`nav-${id}`} className={`nav-seg-wrap ${open ? 'open' : ''}`}>
        <div className="nav-seg-clip">
          <div ref={containerRef} className="nav-seg" role="group" aria-label={label}>
            <span ref={thumbRef} className="nav-seg-thumb" aria-hidden="true" />
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className="nav-seg-btn" title={collapsed ? item.label : undefined} aria-label={item.shortLabel ? item.label : undefined}>
                <span className="nav-seg-icon"><Icon name={item.icon} size={15} /></span>
                <span className="nav-seg-text">{item.shortLabel ?? item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** AI Insights: one ordinary row. Its eight pages are tabs in the page header, not sidebar items. */
function AiNav({ items, collapsed, pathname }: { items: NavItem[]; collapsed: boolean; pathname: string }) {
  const inside = items.some((i) => i.to === pathname);
  return (
    <NavLink to={AI_HOME} className={`nav-link ${inside ? 'active' : ''}`} title={collapsed ? AI_LABEL : undefined}>
      <span className="nav-icon" data-icon="ai"><Icon name="ai" size={18} /></span>
      <span className="nav-label">{AI_LABEL}</span>
      <NewBadge />
    </NavLink>
  );
}

/** Customers: one ordinary row. Stayed, Leads and Templates are tabs in the page header, Stayed first. */
function CustomersNav({ items, collapsed, pathname }: { items: NavItem[]; collapsed: boolean; pathname: string }) {
  const inside = items.some((i) => i.to === pathname);
  return (
    <NavLink to={items[0].to} className={`nav-link ${inside ? 'active' : ''}`} title={collapsed ? CUSTOMERS_LABEL : undefined}>
      <span className="nav-icon" data-icon="users"><Icon name="users" size={18} /></span>
      <span className="nav-label">{CUSTOMERS_LABEL}</span>
    </NavLink>
  );
}

/** Header tabs for a section's pages, left to right. Sticks under the top bar while the page scrolls. */
function SectionTabs({ items, label, flag }: { items: NavItem[]; label: string; flag?: string }) {
  const { pathname } = useLocation();
  const { containerRef, thumbRef } = useSlidingThumb<HTMLElement>('.ai-tab.active', pathname);
  return (
    <nav ref={containerRef} className="ai-tabs no-print" aria-label={label}>
      <span ref={thumbRef} className="ai-tab-thumb" aria-hidden="true" />
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={`ai-tab ${pathname === item.to ? 'active' : ''}`}>
          <Icon name={item.icon} size={15} />
          <span>{item.label}</span>
        </NavLink>
      ))}
      {flag && <span className="ai-tabs-flag" title="Every figure in AI Insights is a sample. Nothing here changes your hotel.">{flag}</span>}
    </nav>
  );
}

function Sidebar({ open, collapsed, onClose, onToggleCollapsed }: { open: boolean; collapsed: boolean; onClose: () => void; onToggleCollapsed: () => void }) {
  const { hotel } = useApp();
  const { can } = useAuth();
  const { pathname } = useLocation();
  const items = NAV.filter((n) => !n.hidden && (!n.anyOf || n.anyOf.some(can)));
  const propertyItems = items.filter((i) => i.inProperty);
  const customerItems = items.filter((i) => i.inCustomers);
  const inProperty = propertyItems.some((i) => i.to === pathname);

  // Each group is open while on one of its pages, and otherwise whenever the person asks. Going elsewhere folds it.
  const [propertyOpen, setPropertyOpen] = useState(inProperty);
  useEffect(() => setPropertyOpen(inProperty), [pathname, inProperty]);

  // AI Insights is the last row, for roles that may see it.
  const aiItems = AI_ANY_OF.some(can) ? AI_NAV : [];

  // A role switch changes which links exist, which moves the active one.
  const { containerRef: navRef, thumbRef: indicatorRef } = useSlidingThumb<HTMLElement>('.nav-link.active:not(.nav-group-toggle)', `${pathname}|${items.map((i) => i.to).join()}`);

  // How many rows must share the height. An open group is one row, or one per page in the rail.
  const groupRows = (list: NavItem[], isOpen: boolean) => (list.length ? 1 + (isOpen ? (collapsed ? list.length : 1.7) : 0) : 0);
  const rows = items.filter((i) => !i.inProperty && !i.inCustomers).length + groupRows(propertyItems, propertyOpen) + (customerItems.length ? 1 : 0) + (aiItems.length ? 1 : 0);

  return (
    <aside className={`sidebar no-print ${open ? 'open' : ''}`} style={{ '--nav-rows': rows } as CSSProperties}>
      <SidebarScenery />
      <div className="sidebar-top">
        <Link to="/app/dashboard" className="brand" title={collapsed ? hotel.name : undefined}>
          <BrandMark size={22} />
          <img src="/images/hotel-pms-logo.png" alt={hotel.name} className="brand-logo" />
        </Link>
        <button
          type="button"
          className="sidebar-collapse"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapsed}
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} size={17} />
        </button>
        <button type="button" className="sidebar-close" aria-label="Close menu" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <nav ref={navRef} aria-label="Main">
        <span ref={indicatorRef} className="nav-indicator" aria-hidden="true" />
        {items.map((item) => {
          if (!item.inProperty && !item.inCustomers) return <NavRow key={item.to} item={item} collapsed={collapsed} />;
          if (item.inCustomers) {
            if (item !== customerItems[0]) return null;
            return <CustomersNav key="customers" items={customerItems} collapsed={collapsed} pathname={pathname} />;
          }
          if (item !== propertyItems[0]) return null;
          return (
            <GroupNav key="property" id="property" label={PROPERTY_LABEL} icon="layers" items={propertyItems} collapsed={collapsed} pathname={pathname} open={propertyOpen} onToggle={() => setPropertyOpen((o) => !o)} />
          );
        })}
        {aiItems.length > 0 && <AiNav key="ai" items={aiItems} collapsed={collapsed} pathname={pathname} />}
      </nav>
    </aside>
  );
}

/**
 * Going to a new page starts at the top. Going back returns to where the person left it, once the
 * page has loaded enough to be that tall. Search-param changes (tabs, filters) stay put.
 */
function useScrollMemory(pathname: string) {
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());

  const current = useRef(pathname);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    // Tracked live: by the time a route change commits, the old page is gone and the height with it.
    const onScroll = () => positions.current.set(current.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const saved = navigationType === 'POP' ? positions.current.get(pathname) ?? 0 : 0;
    current.current = pathname;
    let frame = 0;
    let tries = 0;
    const restore = () => {
      window.scrollTo({ top: saved, behavior: 'instant' });
      if (Math.abs(window.scrollY - saved) > 2 && ++tries < 30) frame = requestAnimationFrame(restore);
    };
    restore();
    return () => cancelAnimationFrame(frame);
  }, [pathname, navigationType]);
}

/* ---------- Shell ---------- */

export function Shell({ children }: { children: ReactNode }) {
  useProductTheme();
  const { prefs, setPrefs } = useApp();
  const { confirm, toast } = useFeedback();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const { can } = useAuth();
  const aiTabs = location.pathname.startsWith('/app/ai/') && AI_ANY_OF.some(can);
  const customerTabs = location.pathname.startsWith('/app/customers/') && can('customers.view');

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useScrollMemory(location.pathname);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      /* The choice lasts for this visit only. */
    }
  };

  const { data: seededOn } = useResource(async () => demoService.seededOn());
  const stale = !!seededOn && seededOn !== today();

  const resetDemo = async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'Every booking, guest, invoice and setting returns to the clean sample story, with dates rebuilt around today. Your changes in this browser will be lost.',
      confirmLabel: 'Reset demo',
      danger: true,
    });
    if (!ok) return;
    demoService.reset();
    toast('Demo data reset. Ready for the next presentation.');
    navigate('/app/dashboard');
  };

  return (
    <div className={`shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className={`scrim ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <Sidebar open={menuOpen} collapsed={collapsed} onClose={() => setMenuOpen(false)} onToggleCollapsed={toggleCollapsed} />
      <div className="main">
        <header className="topbar no-print">
          <button type="button" className="btn btn-ghost btn-icon menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" size={18} />
          </button>
          <GlobalSearch />
          <div className="topbar-right">
            <button
              type="button"
              className="theme-toggle"
              data-theme-toggle=""
              aria-label={prefs.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={prefs.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => setPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}
            >
              <span className="theme-toggle-knob" aria-hidden="true" />
              <Icon name="sun" size={15} />
              <Icon name="moon" size={15} />
            </button>
            <Notifications />
            <AccountMenu onReset={resetDemo} onSwitch={() => setSwitching(true)} />
          </div>
        </header>
        {stale && (
          <div className="sample-note no-print">
            <Icon name="info" />
            <span>Sample dates were built around {fmtDate(seededOn)}. Reset to rebuild today's arrivals and departures.</span>
            <Button size="sm" onClick={resetDemo}>Reset now</Button>
          </div>
        )}
        <main className="content">
          {aiTabs && <SectionTabs items={AI_NAV} label={AI_LABEL} flag="Simulated data" />}
          {customerTabs && <SectionTabs items={NAV.filter((n) => n.inCustomers)} label={CUSTOMERS_LABEL} />}
          {aiTabs && <AiAsk />}
          {/* Keyed by path so each page plays its entrance. Search-param changes do not remount. */}
          <div key={location.pathname} className="page">{children}</div>
        </main>
      </div>
      {switching && <SwitchRoleModal onClose={() => setSwitching(false)} />}
      <FloatingAssistant />
      <CursorLight />
    </div>
  );
}
