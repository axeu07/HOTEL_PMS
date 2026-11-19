import { useEffect, useRef, type CSSProperties } from 'react';
import { Art } from '@/components/art';
import { HOTEL } from '@/data/site';

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * A pinned entrance between "The hotel" and "Rooms & suites".
 *
 * The courtyard picture is the door. While the visitor scrolls through the tall track, the stage stays
 * pinned: the two leaves swing open (0–45%), the view pushes through the doorway (30–90%) and the
 * doorway fades into the page background so the next section, "Four ways to stay", simply scrolls in.
 * Progress is written to CSS variables; the look lives in door.css.
 */
export function DoorEntrance() {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trackEl = track.current;
    const stageEl = stage.current;
    if (!trackEl || !stageEl) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // CSS shows the door already open

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = trackEl.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? clamp(-rect.top / travel) : 0;

      stageEl.style.setProperty('--open', easeInOut(clamp(p / 0.36)).toFixed(4));
      stageEl.style.setProperty('--zoom', easeInOut(clamp((p - 0.2) / 0.48)).toFixed(4));
      stageEl.style.setProperty('--veil', clamp((p - 0.56) / 0.18).toFixed(4));
      stageEl.style.setProperty('--hello', easeInOut(clamp((p - 0.58) / 0.2)).toFixed(4));
      stageEl.style.setProperty('--side', (1 - clamp(p / 0.32)).toFixed(4));
      stageEl.style.setProperty('--cue', (1 - clamp(p / 0.1)).toFixed(4));
      stageEl.classList.toggle('is-through', p > 0.45);
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

  const leaf = (side: 'l' | 'r') => (
    <div className={`door-leaf door-leaf-${side}`} aria-hidden="true">
      <div className="door-leaf-art">
        <Art name="courtyard" title="The jasmine courtyard" />
      </div>
      <span className="door-knob" />
    </div>
  );

  return (
    <section className="door-track" ref={track} aria-label="Step inside the hotel">
      <div className="door-stage" ref={stage} style={{ '--open': 0, '--zoom': 0, '--veil': 0, '--cue': 1, '--hello': 0, '--side': 1 } as CSSProperties}>
        <div className="door-backdrop" aria-hidden="true">
          <div className="door-colonnade" />
          <div className="door-terrace" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <span key={i} className={`door-petal door-petal-${i}`} />)}
        </div>

        <div className="door-title">
          <span className="eyebrow">Welcome</span>
          <h2 className="site-h2">Step inside</h2>
        </div>

        <div className="door-zoom">
          <DoorDecor />
          <div className="door-arch">
            <div className="door-opening">
              <div className="door-inside" aria-hidden="true">
                <span className="door-light" />
              </div>
              {leaf('l')}
              {leaf('r')}
            </div>
          </div>
          <div className="door-step" aria-hidden="true" />
        </div>

        <div className="door-cue" aria-hidden="true">
          <span>Scroll to open the door</span>
          <i />
        </div>
        <div className="door-veil" aria-hidden="true" />

        <div className="door-welcome">
          <span className="eyebrow">You're in</span>
          <h2 className="site-h2">Welcome to Folio</h2>
          <span className="door-welcome-rule" aria-hidden="true"><i /></span>
          <p>Lime-washed walls, a jasmine courtyard and a fire in the reading room. Make yourself at home.</p>
        </div>
      </div>
    </section>
  );
}

/** Lanterns, potted cypresses and two stamps around the doorway. They sit inside .door-zoom, so they fly past as the view pushes through. */
function DoorDecor() {
  return (
    <div className="door-decor" aria-hidden="true">
      <Lantern side="l" />
      <Lantern side="r" />
      <Cypress side="l" />
      <Cypress side="r" />
      <Stamp side="l" ring="A LAKESIDE COURT · HILLS OF NAIRAVALE · " top="EST." big="1926" />
      <Stamp side="r" ring={`CHECK-IN ${HOTEL.checkInTime} · CHECK-OUT ${HOTEL.checkOutTime} · `} top="OPEN" big="Daily" />
    </div>
  );
}

function Lantern({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={`door-lantern door-lantern-${side}`}>
      <span className="door-lantern-glow" />
      <svg viewBox="0 0 64 120">
        <path d="M64 10 H30 Q22 10 22 18 V26" fill="none" stroke="#14302a" strokeWidth="4" strokeLinecap="round" />
        <path d="M64 4 V16" stroke="#14302a" strokeWidth="6" />
        <path d="M22 26 V34" stroke="#14302a" strokeWidth="2" />
        <path d="M8 46 L22 34 L36 46 Z" fill="#14302a" />
        <rect x="10" y="46" width="24" height="40" rx="3" fill="#ffd98a" />
        <ellipse className="door-flame" cx="22" cy="70" rx="4" ry="7" fill="#f2a43a" />
        <path d="M22 46 V86 M10 66 H34" stroke="#14302a" strokeWidth="1.6" opacity="0.5" />
        <rect x="10" y="46" width="24" height="40" rx="3" fill="none" stroke="#14302a" strokeWidth="3" />
        <path d="M6 86 H38 L32 94 H12 Z" fill="#14302a" />
        <circle cx="22" cy="99" r="3" fill="#c9994a" />
      </svg>
    </div>
  );
}

function Cypress({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={`door-plant door-plant-${side}`}>
      <svg viewBox="0 0 100 220">
        <g className="door-plant-sway">
          <path d="M50 4 C70 30 80 70 78 110 C76 140 66 162 50 166 C34 162 24 140 22 110 C20 70 30 30 50 4 Z" fill="#1f4339" />
          <path d="M50 4 C62 30 68 70 66 110 C64 138 58 156 50 166 C46 140 44 90 50 4 Z" fill="#2c5a4c" />
          <path d="M36 60 Q44 66 40 76 M60 92 Q54 100 60 108 M38 120 Q46 126 42 136" stroke="#6f8f7c" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
        <rect x="47" y="160" width="6" height="16" fill="#14302a" />
        <path d="M24 176 H76 L70 216 H30 Z" fill="#b4583a" />
        <rect x="20" y="172" width="60" height="10" rx="2" fill="#9c4a30" />
        <path d="M34 196 H66" stroke="#d99a7c" strokeWidth="2" />
      </svg>
    </div>
  );
}

function Stamp({ side, ring, top, big }: { side: 'l' | 'r'; ring: string; top: string; big: string }) {
  const id = `door-ring-${side}`;
  return (
    <div className={`door-stamp door-stamp-${side}`}>
      <svg viewBox="0 0 200 200">
        <defs>
          <path id={id} d="M100 100 m-78 0 a78 78 0 1 1 156 0 a78 78 0 1 1 -156 0" />
        </defs>
        <circle cx="100" cy="100" r="96" fill="#f3ead6" stroke="#c9994a" strokeWidth="2" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="#c9994a" strokeWidth="1.5" strokeDasharray="3 5" />
        <g className="door-stamp-ring">
          <text fontSize="12.5" letterSpacing="2.6" fill="#14302a" fontFamily="var(--sans)" fontWeight="600">
            <textPath href={`#${id}`}>{ring}{ring}</textPath>
          </text>
        </g>
        <text x="100" y="88" textAnchor="middle" fontSize="12" letterSpacing="3" fill="#8d6216" fontFamily="var(--sans)" fontWeight="600">{top}</text>
        <text x="100" y="122" textAnchor="middle" fontSize="34" fill="#14302a" fontFamily="var(--serif)">{big}</text>
      </svg>
    </div>
  );
}
