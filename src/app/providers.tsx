import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useResource } from '@/hooks/useResource';
import { configureFormat } from '@/lib/format';
import { authService, hotelService } from '@/services';
import type { Hotel, Permission, Role, User, UserPreferences } from '@/types/domain';

/* ---------- Preferences ---------- */

const PREFS_KEY = 'folio.demo.prefs';
const defaultPrefs: UserPreferences = { theme: 'light', density: 'comfortable', dateFormat: 'dmy' };

function loadPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPrefs, ...(JSON.parse(raw) as Partial<UserPreferences>) } : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

/* ---------- Hotel ---------- */

interface AppContextValue {
  hotel: Hotel;
  prefs: UserPreferences;
  setPrefs: (patch: Partial<UserPreferences>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { data: hotel } = useResource(() => hotelService.get());
  const [prefs, setPrefsState] = useState(loadPrefs);

  const setPrefs = useCallback((patch: Partial<UserPreferences>) => {
    const update = () =>
      setPrefsState((current) => {
        const next = { ...current, ...patch };
        try {
          localStorage.setItem(PREFS_KEY, JSON.stringify(next));
        } catch {
          /* Preference lasts for this visit only. */
        }
        return next;
      });
    // Crossfading a snapshot brings gradients, shadows and charts along together, with no flicker.
    const root = document.documentElement;
    const themeChanges = !!patch.theme && !!root.dataset.theme && patch.theme !== root.dataset.theme;
    if (themeChanges && document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => flushSync(update)).ready.catch(() => undefined);
    } else {
      update();
    }
  }, []);

  // Formatters read module state, so set it during render, before children format anything.
  configureFormat({ currency: hotel?.currency, dateFormat: prefs.dateFormat });

  const value = useMemo(() => (hotel ? { hotel, prefs, setPrefs } : null), [hotel, prefs, setPrefs]);
  if (!value) return null;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

/** The theme applies to the signed-in product only; the public site has its own look. */
export function useProductTheme() {
  const { prefs } = useApp();
  // Before paint, and in time for the theme crossfade's second snapshot.
  useLayoutEffect(() => {
    const root = document.documentElement;
    delete root.dataset.boot;
    root.dataset.theme = prefs.theme;
    root.dataset.density = prefs.density;
    return () => {
      delete root.dataset.theme;
      delete root.dataset.density;
    };
  }, [prefs.theme, prefs.density]);
}

/* ---------- Auth ---------- */

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  ready: boolean;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signInAs: (userId: string) => Promise<User>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  const apply = useCallback(async (next: User | null) => {
    setUser(next);
    setRole(next ? ((await authService.role(next.roleId)) ?? null) : null);
  }, []);

  useEffect(() => {
    authService.currentUser().then(apply).finally(() => setReady(true));
  }, [apply]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      ready,
      can: (permission) => !!role?.permissions.includes(permission),
      signIn: async (email, password) => {
        const signedIn = await authService.signIn(email, password);
        await apply(signedIn);
        return signedIn;
      },
      signInAs: async (userId) => {
        const signedIn = await authService.signInAs(userId);
        await apply(signedIn);
        return signedIn;
      },
      signOut: () => {
        authService.signOut();
        setUser(null);
        setRole(null);
      },
      refreshUser: async () => {
        await apply(await authService.currentUser());
      },
    }),
    [user, role, ready, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
