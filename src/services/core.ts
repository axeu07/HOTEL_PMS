import { repositories, resetDatabase, seededOn } from '@/repositories';
import { DomainError } from '@/lib/validation';
import type { ActivityItem, ActivityTone, Hotel, RoleId, Session, User } from '@/types/domain';

export const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ---------- Activity & notifications ---------- */

export const activityService = {
  async list(): Promise<ActivityItem[]> {
    const items = await repositories.activity.list();
    return items.sort((a, b) => b.at.localeCompare(a.at));
  },
  async log(message: string, tone: ActivityTone, link: string) {
    await repositories.activity.create({
      id: newId('act'),
      message,
      tone,
      link,
      at: new Date().toISOString(),
      read: false,
    });
  },
  async markRead(id: string) {
    await repositories.activity.update(id, { read: true });
  },
  async markAllRead() {
    const items = await repositories.activity.list();
    await Promise.all(items.filter((i) => !i.read).map((i) => repositories.activity.update(i.id, { read: true })));
  },
};

/* ---------- Hotel profile ---------- */

export const hotelService = {
  async get(): Promise<Hotel> {
    const [hotel] = await repositories.hotels.list();
    return hotel;
  },
  async update(patch: Partial<Hotel>): Promise<Hotel> {
    const hotel = await hotelService.get();
    return repositories.hotels.update(hotel.id, patch);
  },
};

/* ---------- Demo authentication ---------- */

const SESSION_KEY = 'folio.demo.session';

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Session lasts for this page load only. */
  }
}

/** Simulated auth. Replace with a real identity provider before production. */
export const authService = {
  async demoAccounts(): Promise<User[]> {
    return repositories.users.list();
  },
  roles: () => repositories.roles.list(),
  role: (id: RoleId) => repositories.roles.get(id),
  async signIn(email: string, password: string): Promise<User> {
    const users = await repositories.users.list();
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.demoPassword !== password) {
      throw new DomainError('Those details do not match a demo account. Use a sample login below.');
    }
    writeSession({ userId: user.id, signedInAt: new Date().toISOString() });
    return user;
  },
  async signInAs(userId: string): Promise<User> {
    const user = await repositories.users.get(userId);
    if (!user) throw new DomainError('That demo account no longer exists.');
    writeSession({ userId: user.id, signedInAt: new Date().toISOString() });
    return user;
  },
  async currentUser(): Promise<User | null> {
    const session = readSession();
    if (!session) return null;
    return (await repositories.users.get(session.userId)) ?? null;
  },
  signOut() {
    writeSession(null);
  },
  async updateProfile(userId: string, patch: Pick<User, 'name' | 'email'>): Promise<User> {
    return repositories.users.update(userId, patch);
  },
};

/* ---------- Demo lifecycle ---------- */

export const demoService = {
  reset() {
    resetDatabase();
  },
  seededOn,
};
