import type { CSSProperties } from 'react';
import { useParallax } from '@/components/motion';

type Vars = CSSProperties & Record<`--${string}`, string | number>;
const t = (duration: number, delay = 0, extra: Vars = {}): Vars => ({ animationDuration: `${duration}s`, animationDelay: `${-delay}s`, ...extra });

function Pine({ x, y, s, fill, delay }: { x: number; y: number; s: number; fill: string; delay: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="m-sway" style={t(4.5 + (delay % 3), delay)} fill={fill}>
        <path d="M0 -46 L10 -26 L5 -27 L14 -10 L7 -11 L17 6 H-17 L-7 -11 L-14 -10 L-5 -27 L-10 -26Z" />
        <rect x="-2.5" y="6" width="5" height="9" />
      </g>
    </g>
  );
}

/**
 * The closing view for the Visit section: a night-time mountain skyline above the hotel, with stars,
 * a moon, drifting cloud, fireflies, a cable car on its line and the lodge with its windows lit.
 * Layers drift at different speeds as the page scrolls.
 */
export function VisitScene() {
  const ref = useParallax<HTMLDivElement>();
  return (
    <div ref={ref} className="visit-scene" aria-hidden="true">
      <svg viewBox="0 0 1200 440" preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <linearGradient id="vs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1426" />
            <stop offset=".55" stopColor="#1b3050" />
            <stop offset="1" stopColor="#3a5a66" />
          </linearGradient>
          <radialGradient id="vs-moon" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#fff6dc" stopOpacity=".5" />
            <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1200" height="440" fill="url(#vs-sky)" />

        <g className="vs-layer" style={{ '--depth': -6 } as Vars}>
          {Array.from({ length: 44 }, (_, i) => {
            const x = (i * 281 + 37) % 1200;
            const y = (i * 67 + 11) % 190;
            return <circle key={i} className="m-twinkle" cx={x} cy={y} r={0.8 + (i % 3) * 0.5} fill="#fff6dc" style={t(2.2 + (i % 5) * 0.7, (i * 0.37) % 4)} />;
          })}
          <circle cx="940" cy="82" r="64" fill="url(#vs-moon)" className="m-glow" style={t(8)} />
          <circle cx="940" cy="82" r="24" fill="#fff6dc" />
        </g>

        <g transform="translate(0 80)">
        <g className="vs-layer" style={{ '--depth': -14 } as Vars}>
          <path d="M0 250 L90 170 L150 214 L250 118 L350 210 L440 150 L540 226 L650 130 L760 220 L860 162 L960 226 L1060 148 L1200 220 V360 H0Z" fill="#33506a" />
          {['M250 118 L226 160 L240 152 L252 164 L264 151 L278 160Z', 'M650 130 L628 168 L641 161 L652 171 L663 160 L676 168Z', 'M1060 148 L1040 182 L1052 176 L1062 186 L1072 176 L1084 182Z'].map((d) => <path key={d} d={d} fill="#eaf2ff" opacity=".9" />)}
          {/* Cable car */}
          <path d="M120 300 L1060 232" stroke="#cfd9e6" strokeWidth="1.5" opacity=".6" />
          <g className="m-cable wide">
            <g transform="translate(120 300)">
              <path d="M0 0 V16" stroke="#cfd9e6" strokeWidth="1.5" />
              <rect x="-13" y="16" width="26" height="18" rx="4" fill="#e3bb72" />
              <rect x="-9" y="20" width="7" height="8" fill="#fff6dc" />
              <rect x="2" y="20" width="7" height="8" fill="#fff6dc" />
            </g>
          </g>
        </g>

        <g className="vs-layer" style={{ '--depth': -26 } as Vars}>
          <g className="m-drift wide" style={t(60)}><g fill="#cfdcec" opacity=".28"><ellipse cx="220" cy="196" rx="120" ry="12" /><ellipse cx="620" cy="214" rx="150" ry="13" /><ellipse cx="1010" cy="200" rx="130" ry="12" /></g></g>
          <path d="M0 290 C130 238 230 280 360 246 S600 236 720 270 S1000 244 1200 280 V360 H0Z" fill="#1d3a40" />
        </g>

        <g className="vs-layer" style={{ '--depth': -42 } as Vars}>
          <path d="M0 322 C150 290 280 318 430 296 S720 290 860 312 S1080 296 1200 314 V360 H0Z" fill="#0f2425" />
          {/* The lodge */}
          <g transform="translate(600 308)">
            <rect x="-74" y="-46" width="148" height="50" fill="#d8c4a2" />
            <path d="M-90 -46 L0 -104 L90 -46Z" fill="#7a3a38" />
            <rect x="38" y="-104" width="14" height="34" fill="#7a3a38" />
            {[0, 1, 2, 3].map((i) => <circle key={i} className="m-puff" cx="45" cy="-108" r="7" fill="#cfdcf0" opacity=".6" style={t(5, i * 1.25)} />)}
            {[-56, -34, -12, 10, 32, 54].map((x, i) => <rect key={x} className="m-flicker" x={x} y="-34" width="12" height="16" rx="2" fill="#ffd27a" style={t(3.2 + (i % 3) * 0.9, i * 0.7)} />)}
            <path d="M-12 4 V-12 a12 12 0 0 1 24 0 V4Z" fill="#5a3a28" />
          </g>
          <circle className="m-glow" style={t(5)} cx="600" cy="300" r="150" fill="url(#glow-warm)" opacity=".5" />
          {[[40, 330, 1.7], [112, 336, 1.3], [250, 334, 1.5], [330, 338, 1.2], [880, 332, 1.8], [960, 338, 1.3], [1040, 332, 1.6], [1110, 338, 1.4], [1170, 330, 1.7]].map(([x, y, s], i) => (
            <Pine key={x} x={x} y={y} s={s} fill="#0b1c1c" delay={i * 0.8} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={i} className="m-firefly" cx={(i * 197 + 80) % 1200} cy={286 + ((i * 37) % 60)} r="2.2" fill="#e8ff9a" style={t(7 + (i % 4) * 2, i * 1.1, { '--fx': `${(i % 2 ? 1 : -1) * (20 + (i % 3) * 12)}px` })} />
          ))}
        </g>
        </g>
      </svg>
    </div>
  );
}

/** A thin ridgeline between sections; the layers drift apart as it scrolls through view. */
export function RidgeDivider({ from, to }: { from: string; to: string }) {
  const ref = useParallax<HTMLDivElement>();
  return (
    <div ref={ref} className="ridge" style={{ background: from }} aria-hidden="true">
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" focusable="false">
        <g className="vs-layer" style={{ '--depth': 18 } as Vars}>
          <path d="M-40 90 L80 40 L150 74 L260 14 L360 76 L450 38 L560 84 L680 20 L790 78 L890 44 L1000 86 L1100 30 L1240 80 V130 H-40Z" fill={to} opacity=".35" />
        </g>
        <g className="vs-layer" style={{ '--depth': 8 } as Vars}>
          <path d="M-40 104 C100 70 200 98 330 80 S560 68 700 94 S960 78 1240 100 V130 H-40Z" fill={to} opacity=".6" />
        </g>
        <path d="M0 112 C140 96 260 112 400 104 S700 96 840 108 S1100 100 1200 108 V120 H0Z" fill={to} />
        <g fill={to}>
          {[[90, 104, 1], [180, 108, 0.8], [430, 102, 1.1], [760, 106, 0.9], [1010, 102, 1.2], [1120, 106, 0.8]].map(([x, y, s], i) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${s * 0.6})`}>
              <g className="m-sway" style={t(4 + (i % 3), i * 0.9)}>
                <path d="M0 -46 L10 -26 L5 -27 L14 -10 L7 -11 L17 6 H-17 L-7 -11 L-14 -10 L-5 -27 L-10 -26Z" />
              </g>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
