import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { subscribeToData } from '@/repositories';

/**
 * Loads async data and re-runs after any write, so every open screen stays
 * current. Previous data stays on screen during a refresh. With a real API,
 * point the subscription at query invalidation or a websocket.
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const latest = useRef(fetcher);
  latest.current = fetcher;
  const generation = useRef(0);

  const load = useCallback(() => {
    const mine = ++generation.current;
    latest.current().then(
      (value) => {
        if (mine === generation.current) {
          setData(value);
          setError(null);
        }
      },
      (e) => {
        if (mine === generation.current) setError(e);
      },
    );
  }, []);

  useEffect(() => {
    load();
    // A single action can write several records; refresh once they have landed.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToData(() => {
      clearTimeout(timer);
      timer = setTimeout(load, 0);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      generation.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading: data === null && !error, reload: load };
}
