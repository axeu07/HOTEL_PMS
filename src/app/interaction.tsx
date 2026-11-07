import { useEffect, useRef } from 'react';

/*
 * The pointer-driven part of the interface: the light that follows the mouse, the light on the
 * surface under it, and the small tilt on cards.
 *
 * One passive listener on the document covers every screen and dialog, so components need no wiring.
 * It writes at most once a frame, directly to the DOM, and never touches React state, so moving the
 * mouse re-renders nothing. It stays off on touch screens and when motion is reduced; those get the
 * press feedback in interaction.css instead.
 */

const POINTER_EFFECTS = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/** Surfaces that light up near the cursor. Nested ones all respond, innermost first. */
const LIT = [
  '.panel', '.stat-card', '.mini-stat', '.ticket', '.menu-card', '.category-card', '.shift-card', '.kanban-col',
  '.modal', '.popover', '.search-results', '.btn', '.nav-link', '.nav-seg-btn', '.table tbody tr',
].join(',');

/** Things that tilt, with the most they may rotate in degrees. Large panels stay still on purpose. */
const TILT: { selector: string; x: number; y: number }[] = [
  { selector: '.nav-link', x: 2, y: 1 },
  { selector: '.stat-card, .category-card, .menu-card, .ticket, .shift-card', x: 2, y: 2 },
];
const TILT_ANY = TILT.map((t) => t.selector).join(',');

function litChain(from: Element): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let el = from.closest<HTMLElement>(LIT);
  while (el) {
    chain.push(el);
    el = el.parentElement?.closest<HTMLElement>(LIT) ?? null;
  }
  return chain;
}

function startPointerEffects(light: HTMLElement) {
  let frame = 0;
  let x = 0;
  let y = 0;
  let target: Element | null = null;
  let tilted: HTMLElement | null = null;

  const clearTilt = () => {
    if (!tilted) return;
    tilted.style.removeProperty('--tilt-x');
    tilted.style.removeProperty('--tilt-y');
    tilted.classList.remove('is-tilting');
    tilted = null;
  };

  const apply = () => {
    frame = 0;
    light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (!target?.isConnected) return;

    // All reads, then all writes, so one frame never forces layout twice.
    const chain = litChain(target);
    const boxes = chain.map((el) => el.getBoundingClientRect());
    const tiltEl = target.closest<HTMLElement>(TILT_ANY);
    const tiltBox = tiltEl?.getBoundingClientRect();

    chain.forEach((el, i) => {
      el.style.setProperty('--mx', `${(x - boxes[i].left).toFixed(1)}px`);
      el.style.setProperty('--my', `${(y - boxes[i].top).toFixed(1)}px`);
    });

    if (tilted !== tiltEl) clearTilt();
    if (!tiltEl || !tiltBox) return;
    const limit = TILT.find((t) => tiltEl.matches(t.selector))!;
    const across = (x - tiltBox.left) / tiltBox.width - 0.5;
    const down = (y - tiltBox.top) / tiltBox.height - 0.5;
    tiltEl.style.setProperty('--tilt-x', `${(-down * limit.x * 2).toFixed(2)}deg`);
    tiltEl.style.setProperty('--tilt-y', `${(across * limit.y * 2).toFixed(2)}deg`);
    tiltEl.classList.add('is-tilting');
    tilted = tiltEl;
  };

  const onMove = (e: PointerEvent) => {
    // A hybrid laptop can report touch even where a mouse is also present.
    if (e.pointerType === 'touch') return;
    x = e.clientX;
    y = e.clientY;
    target = e.target instanceof Element ? e.target : null;
    light.classList.add('visible');
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const onLeave = () => {
    light.classList.remove('visible');
    clearTilt();
  };
  // Scrolling moves the card out from under a stale reading; it settles until the next move.
  const onScroll = () => clearTilt();

  const root = document.documentElement;
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });
  root.addEventListener('pointerleave', onLeave);

  return () => {
    cancelAnimationFrame(frame);
    clearTilt();
    light.classList.remove('visible');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('scroll', onScroll, { capture: true });
    root.removeEventListener('pointerleave', onLeave);
  };
}

/** Mount once inside the signed-in shell. */
export function CursorLight() {
  const lightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const query = window.matchMedia(POINTER_EFFECTS);
    let stop: (() => void) | undefined;
    const sync = () => {
      stop?.();
      stop = query.matches ? startPointerEffects(light) : undefined;
    };
    sync();
    query.addEventListener('change', sync);
    return () => {
      query.removeEventListener('change', sync);
      stop?.();
    };
  }, []);

  useEffect(() => {
    // iOS Safari only applies :active when the page listens for touches.
    const noop = () => undefined;
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);

  return (
    <div ref={lightRef} className="cursor-light no-print" aria-hidden="true">
      <span className="cursor-halo" />
    </div>
  );
}
