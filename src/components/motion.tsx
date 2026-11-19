import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { money } from '@/lib/format';

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Tracks whether an element is on screen. `seen` flips once and stays; `visible` follows the viewport,
 * which lets the CSS pause looping illustrations that nobody can see.
 */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setSeen(true);
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, seen, visible };
}

/**
 * Soft radial gradients shared by every illustration's lamp, sun and fire glow: `fill="url(#glow-warm)"`.
 * Render once near the top of the page.
 */
export function GlowDefs() {
  const glow = (id: string, color: string) => (
    <radialGradient id={`glow-${id}`}>
      <stop offset="0" stopColor={color} stopOpacity="0.75" />
      <stop offset="0.45" stopColor={color} stopOpacity="0.28" />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </radialGradient>
  );
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {glow('warm', '#ffd98a')}
        {glow('cream', '#fff3d2')}
        {glow('fire', '#ff9a3c')}
      </defs>
    </svg>
  );
}

interface RevealProps {
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  [key: string]: unknown;
}

/** Fades and lifts its content into place the first time it scrolls into view. */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }: RevealProps) {
  const { ref, seen, visible } = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`rv${seen ? ' in' : ''} ${className}`.trim()}
      data-vis={visible}
      style={{ '--d': `${delay}ms`, ...style } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Writes a -0.5…0.5 scroll position to `--p` on the element, so CSS layers can drift at their own speed:
 * `transform: translateY(calc(var(--p) * var(--depth) * 1px))`.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < -120 || rect.top > vh + 120) return;
      el.style.setProperty('--p', ((rect.top + rect.height / 2 - vh / 2) / vh).toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}

/**
 * Makes a horizontally scrolling row draggable with a mouse (touch already scrolls natively) and reports
 * which slide is nearest the start. A drag never turns into a click on the cards inside.
 */
export function useCarousel<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;

    const slideStep = () => {
      const first = el.children[0] as HTMLElement | undefined;
      const second = el.children[1] as HTMLElement | undefined;
      return first && second ? second.offsetLeft - first.offsetLeft : el.clientWidth;
    };
    const onScroll = () => setActive(Math.round(el.scrollLeft / slideStep()));
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        el.classList.add('is-dragging');
      }
      if (moved) el.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      el.classList.remove('is-dragging');
    };
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  const goTo = (index: number) => {
    const el = ref.current;
    const target = el?.children[index] as HTMLElement | undefined;
    if (el && target) el.scrollTo({ left: target.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: 'smooth' });
  };

  return { ref, active, goTo };
}

/** A rupee price that counts up to its value when it first scrolls into view. */
export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const { ref, seen } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);

  useEffect(() => {
    if (!seen || prefersReducedMotion()) {
      if (prefersReducedMotion()) setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, value, duration]);

  return <span ref={ref}>{money(shown)}</span>;
}
