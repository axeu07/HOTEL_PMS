import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Reads `?focus=<id>`, set when a page is opened from Quick Actions, and scrolls to the element marked
 * `data-focused` once the page's data has loaded.
 */
export function useFocusedRecord(ready: boolean): string | null {
  const [params] = useSearchParams();
  const focusId = params.get('focus');
  useEffect(() => {
    if (!ready || !focusId) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('[data-focused]')?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [ready, focusId]);
  return focusId;
}
