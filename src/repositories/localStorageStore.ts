import { createSeedDatabase, SEED_VERSION } from '@/data/seed';
import { today } from '@/lib/dates';
import type { DemoDatabase, Entity, ID } from '@/types/domain';
import type { Repository } from './types';

const DB_KEY = 'folio.demo.db';
const META_KEY = 'folio.demo.meta';

interface Meta {
  version: number;
  seededOn: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();

let cache: DemoDatabase | null = null;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Private mode or blocked storage: the demo still runs in memory.
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* In-memory only for this visit. */
  }
}

function seed(): DemoDatabase {
  const db = createSeedDatabase();
  writeStorage(DB_KEY, JSON.stringify(db));
  writeStorage(META_KEY, JSON.stringify({ version: SEED_VERSION, seededOn: today() } satisfies Meta));
  return db;
}

/** Collections added after a store was written start empty rather than missing. */
function withNewCollections(db: DemoDatabase): DemoDatabase {
  db.occasions ??= [];
  return db;
}

function database(): DemoDatabase {
  if (cache) return cache;
  const raw = readStorage(DB_KEY);
  const meta = readMeta();
  if (raw && meta?.version === SEED_VERSION) {
    try {
      cache = withNewCollections(JSON.parse(raw) as DemoDatabase);
      return cache;
    } catch {
      /* Corrupt store: fall through to a clean seed. */
    }
  }
  cache = seed();
  return cache;
}

function readMeta(): Meta | null {
  const raw = readStorage(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Meta;
  } catch {
    return null;
  }
}

/**
 * Another tab (a guest review page, say) may have written since this one last looked. Reading the
 * stored copy before each write stops a stale tab from overwriting that work.
 */
function refreshFromStorage(): boolean {
  const raw = readStorage(DB_KEY);
  if (!raw || readMeta()?.version !== SEED_VERSION) return false;
  try {
    cache = withNewCollections(JSON.parse(raw) as DemoDatabase);
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY && refreshFromStorage()) listeners.forEach((l) => l());
  });
}

function commit() {
  writeStorage(DB_KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

/** Notifies on every write; `useResource` uses it to keep open pages current. */
export function subscribeToData(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetDatabase() {
  cache = seed();
  listeners.forEach((l) => l());
}

export function seededOn(): string {
  database();
  return readMeta()?.seededOn ?? today();
}

export function createRepository<K extends keyof DemoDatabase>(
  collection: K,
): Repository<DemoDatabase[K][number] & Entity> {
  type T = DemoDatabase[K][number] & Entity;
  const rows = () => database()[collection] as unknown as T[];
  const clone = <V,>(value: V): V => structuredClone(value);

  return {
    async list() {
      return clone(rows());
    },
    async get(id: ID) {
      const row = rows().find((r) => r.id === id);
      return row ? clone(row) : undefined;
    },
    async create(entity: T) {
      refreshFromStorage();
      rows().push(clone(entity));
      commit();
      return clone(entity);
    },
    async update(id: ID, patch: Partial<T>) {
      refreshFromStorage();
      const row = rows().find((r) => r.id === id);
      if (!row) throw new Error(`Record ${id} not found in ${String(collection)}`);
      Object.assign(row, clone(patch));
      commit();
      return clone(row);
    },
    async remove(id: ID) {
      refreshFromStorage();
      const list = rows();
      const index = list.findIndex((r) => r.id === id);
      if (index >= 0) {
        list.splice(index, 1);
        commit();
      }
    },
  };
}
