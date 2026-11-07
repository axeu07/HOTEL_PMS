import { useLayoutEffect, useRef } from 'react';

/**
 * Keeps one highlight element over whichever child matches `activeSelector`.
 *
 * Writes the child's box to CSS variables on the thumb; the stylesheet decides how to use them and
 * animates only once `.ready` is on, so the first paint places it without sliding. `key` must change
 * whenever the active child can have changed. Size changes are picked up by the observer.
 */
export function useSlidingThumb<C extends HTMLElement = HTMLElement>(activeSelector: string, key: string) {
  const containerRef = useRef<C>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const thumb = thumbRef.current;
    if (!container || !thumb) return;
    const place = () => {
      const active = container.querySelector<HTMLElement>(activeSelector);
      thumb.style.opacity = active ? '1' : '0';
      if (!active) return;
      thumb.style.setProperty('--x', `${active.offsetLeft}px`);
      thumb.style.setProperty('--y', `${active.offsetTop}px`);
      thumb.style.setProperty('--w', `${active.offsetWidth}px`);
      thumb.style.setProperty('--h', `${active.offsetHeight}px`);
    };
    place();
    const frame = requestAnimationFrame(() => thumb.classList.add('ready'));
    const observer = new ResizeObserver(place);
    observer.observe(container);
    // Rows can move without the container resizing (e.g. a group above the active row expanding or
    // folding), so watch the children too and re-place once any layout transition finishes.
    Array.from(container.children).forEach((child) => {
      if (child !== thumb) observer.observe(child);
    });
    container.addEventListener('transitionend', place);
    return () => {
      container.removeEventListener('transitionend', place);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeSelector, key]);

  return { containerRef, thumbRef };
}
