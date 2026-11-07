import { useEffect, useRef } from 'react';

/**
 * Folio, the assistant: a small robot with a head, face, body, arms and feet. All motion is CSS
 * (bob, blink, wave, antenna glow); the pupils follow the pointer a little. Reduced motion stills it.
 */
export function Mascot({ size = 76, headOnly = false, look = true }: { size?: number; headOnly?: boolean; look?: boolean }) {
  const pupils = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!look || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      const el = pupils.current;
      if (!el) return;
      const r = el.ownerSVGElement!.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 3);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 200) * 2.2;
      el.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [look]);

  return (
    <svg className={`mascot ${headOnly ? 'mascot-head' : ''}`} width={size} height={headOnly ? size : size * 1.15} viewBox={headOnly ? '14 6 52 46' : '0 0 80 92'} aria-hidden="true" focusable="false">
      <ellipse className="mascot-shadow" cx="40" cy="88" rx="18" ry="3" />
      <g className="mascot-float">
        {!headOnly && (
          <>
            {/* body */}
            <rect x="26" y="52" width="28" height="26" rx="12" className="m-body" />
            <circle cx="40" cy="65" r="4" className="m-core" />
            {/* feet */}
            <rect x="29" y="77" width="9" height="7" rx="3.5" className="m-limb" />
            <rect x="42" y="77" width="9" height="7" rx="3.5" className="m-limb" />
            {/* arms */}
            <g className="m-arm-l"><rect x="17" y="55" width="10" height="6" rx="3" className="m-limb" /></g>
            <g className="m-arm-r"><rect x="53" y="55" width="10" height="6" rx="3" className="m-limb" /></g>
          </>
        )}
        {/* antenna */}
        <line x1="40" y1="8" x2="40" y2="15" className="m-ant" />
        <circle cx="40" cy="7" r="3" className="m-bulb" />
        {/* head */}
        <rect x="16" y="14" width="48" height="38" rx="16" className="m-head" />
        <rect x="21" y="20" width="38" height="26" rx="12" className="m-face" />
        <circle cx="21" cy="34" r="3" className="m-ear" />
        <circle cx="59" cy="34" r="3" className="m-ear" />
        {/* eyes */}
        <g className="m-eyes">
          <ellipse cx="32" cy="32" rx="5" ry="5.5" className="m-eye" />
          <ellipse cx="48" cy="32" rx="5" ry="5.5" className="m-eye" />
          <g ref={pupils} className="m-pupils">
            <circle cx="32" cy="32" r="2.4" className="m-pupil" />
            <circle cx="48" cy="32" r="2.4" className="m-pupil" />
          </g>
        </g>
        <circle cx="26" cy="40" r="2.4" className="m-cheek" />
        <circle cx="54" cy="40" r="2.4" className="m-cheek" />
        <path d="M35 40 Q40 44.5 45 40" className="m-smile" />
      </g>
    </svg>
  );
}
