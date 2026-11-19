import type { CSSProperties, ReactNode } from 'react';

/**
 * Animated mountain scenes for the four room ads: Standard (dawn), Deluxe (golden hour),
 * Premium (twilight) and Suite (snowy night). Pure SVG; every motion is a CSS class
 * defined in styles/landing-motion.css, so it pauses off screen and stops for reduced motion.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>;
const t = (duration: number, delay = 0, extra: Vars = {}): Vars => ({ animationDuration: `${duration}s`, animationDelay: `${-delay}s`, ...extra });

/* ---------- Shared pieces ---------- */

function Cloud({ x, y, s = 1, fill = '#fff', opacity = 0.75, duration = 26, delay = 0 }: { x: number; y: number; s?: number; fill?: string; opacity?: number; duration?: number; delay?: number }) {
  return (
    <g className="m-drift" style={t(duration, delay)}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill} opacity={opacity}>
        <ellipse cx="0" cy="0" rx="34" ry="9" />
        <ellipse cx="-12" cy="-8" rx="18" ry="9" />
        <ellipse cx="12" cy="-10" rx="22" ry="11" />
      </g>
    </g>
  );
}

function Pine({ x, y, s = 1, fill, delay = 0 }: { x: number; y: number; s?: number; fill: string; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="m-sway" style={t(4 + (delay % 3), delay)} fill={fill}>
        <path d="M0 -46 L10 -26 L5 -27 L14 -10 L7 -11 L17 6 H-17 L-7 -11 L-14 -10 L-5 -27 L-10 -26Z" />
        <rect x="-2.5" y="6" width="5" height="9" />
      </g>
    </g>
  );
}

function Birds({ y = 70, color = '#2c3b36' }: { y?: number; color?: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
      {[0, 1, 2].map((i) => (
        <g key={i} className="m-fly" style={t(19 + i * 3, i * 5.5, { '--fy': `${i % 2 ? -14 : 10}px` })}>
          <g transform={`translate(${-30 - i * 22} ${y + i * 14})`}>
            <path className="m-flap" style={t(0.7, i * 0.2)} d="M0 0 q5 -6 10 0 q5 -6 10 0" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Stars({ points, color = '#fff6dc' }: { points: [number, number, number][]; color?: string }) {
  return (
    <g fill={color}>
      {points.map(([x, y, r], i) => (
        <circle key={`${x}-${y}`} className="m-twinkle" cx={x} cy={y} r={r} style={t(2.4 + (i % 4) * 0.8, i * 0.7)} />
      ))}
    </g>
  );
}

function Snowfall({ count = 22, color = '#fff' }: { count?: number; color?: string }) {
  return (
    <g fill={color}>
      {Array.from({ length: count }, (_, i) => {
        const x = (i * 53 + 17) % 400;
        const r = 1 + (i % 3) * 0.55;
        return <circle key={i} className="m-snow" cx={x} cy={0} r={r} style={t(6 + (i % 5) * 1.6, (i * 1.3) % 9, { '--sx': `${(i % 2 ? 1 : -1) * (8 + (i % 4) * 5)}px` })} />;
      })}
    </g>
  );
}

function Lodge({ x, y, s = 1, body = '#e9d9b8', roof = '#9c4a33', lit = '#ffd27a', smoke = '#ffffff', smokeOpacity = 0.7 }: { x: number; y: number; s?: number; body?: string; roof?: string; lit?: string; smoke?: string; smokeOpacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-24" y="-18" width="48" height="22" fill={body} />
      <path d="M-30 -18 L0 -38 L30 -18Z" fill={roof} />
      <rect x="12" y="-40" width="6" height="13" fill={roof} />
      {[0, 1, 2].map((i) => (
        <circle key={i} className="m-puff" cx="15" cy="-42" r="3.5" fill={smoke} opacity={smokeOpacity} style={t(5, i * 1.7)} />
      ))}
      {[-15, -3, 9].map((wx, i) => (
        <rect key={wx} className="m-flicker" x={wx} y="-11" width="7" height="9" rx="1" fill={lit} style={t(3 + i * 0.9, i * 0.8)} />
      ))}
    </g>
  );
}

function Sky({ id, stops }: { id: string; stops: [string, string][] }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
      </linearGradient>
    </defs>
  );
}

const FAR_PEAKS = 'M0 196 L48 132 L82 160 L140 70 L206 158 L252 112 L318 168 L362 124 L400 150 V300 H0Z';
const MID_RIDGE = 'M0 226 C60 176 112 208 172 178 S300 156 400 206 V300 H0Z';
const NEAR_RIDGE = 'M0 262 C84 226 164 254 244 232 S360 224 400 246 V300 H0Z';
const SNOW_CAPS = ['M140 70 L119 108 L130 102 L141 112 L152 101 L163 108Z', 'M252 112 L238 136 L246 131 L253 138 L261 131 L268 136Z', 'M48 132 L36 150 L44 146 L50 152 L58 146 L62 152Z'];

function Peaks({ far, mid, near, snow = '#fff', snowOpacity = 0.9 }: { far: string; mid: string; near: string; snow?: string; snowOpacity?: number }) {
  return (
    <>
      <path d={FAR_PEAKS} fill={far} />
      {SNOW_CAPS.map((d) => <path key={d} d={d} fill={snow} opacity={snowOpacity} />)}
      <path d={MID_RIDGE} fill={mid} />
      <path d={NEAR_RIDGE} fill={near} />
    </>
  );
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label} className="room-scene">
      {children}
    </svg>
  );
}

/* ---------- 1. Standard: dawn through a curtained window ---------- */

function StandardScene() {
  return (
    <Frame label="Dawn over pine hills, seen from a cosy room with a bedside lamp">
      <Sky id="std-sky" stops={[['0', '#9dc2d6'], ['0.55', '#f3d3b0'], ['1', '#f7e2c4']]} />
      <rect width="400" height="300" fill="url(#std-sky)" />
      <g className="m-sunrise">
        <circle cx="272" cy="168" r="46" fill="url(#glow-warm)" opacity=".95" className="m-glow" style={t(5)} />
        <circle cx="272" cy="168" r="24" fill="#fff4d6" />
      </g>
      <Cloud x={90} y={64} s={1.1} duration={30} />
      <Cloud x={300} y={92} s={0.8} duration={36} delay={12} opacity={0.6} />
      <Peaks far="#b3c6d1" mid="#8eae9b" near="#52806b" />
      <ellipse className="m-drift" style={t(18, 4)} cx="130" cy="214" rx="120" ry="9" fill="#fff" opacity=".42" />
      <ellipse className="m-drift" style={t(24, 10)} cx="300" cy="236" rx="140" ry="8" fill="#fff" opacity=".35" />
      <Lodge x={96} y={228} s={0.9} />
      {[[40, 256, 1.2], [168, 262, 1.4], [330, 254, 1.1], [372, 262, 1.5]].map(([x, y, s], i) => <Pine key={x} x={x} y={y} s={s} fill={i % 2 ? '#2f5946' : '#3a6a54'} delay={i * 1.3} />)}
      <Birds y={64} />

      {/* Window frame, curtains and the sill */}
      <path d="M0 0H400V300H0Z M22 18H378V252H22Z" fill="#4a372b" fillRule="evenodd" />
      <path d="M200 18V252M22 135H378" stroke="#4a372b" strokeWidth="6" />
      <path className="m-curtain" d="M22 18 H92 C82 80 100 150 84 252 H22Z" fill="#c9774f" />
      <path className="m-curtain r" d="M378 18 H308 C318 80 300 150 316 252 H378Z" fill="#c9774f" />
      <path d="M40 18v234M58 18v234M360 18v234M342 18v234" stroke="#a9593a" strokeWidth="2" opacity=".6" />
      <rect x="0" y="252" width="400" height="48" fill="#6b4a36" />
      <rect x="0" y="252" width="400" height="6" fill="#8a6247" />
      {/* Bedside lamp */}
      <g>
        <circle className="m-glow" style={t(4)} cx="318" cy="244" r="46" fill="url(#glow-warm)" opacity=".95" />
        <rect x="312" y="256" width="12" height="28" fill="#3a2b22" />
        <path d="M298 258 L308 232 H328 L338 258Z" fill="#f6dfa8" />
        <rect className="m-flicker" style={t(5)} x="304" y="238" width="28" height="16" fill="#fff0c0" opacity=".6" />
      </g>
      {/* Tea cup */}
      <g>
        <path d="M82 262 h26 l-3 16 h-20z" fill="#f3ead6" />
        {[0, 1].map((i) => <path key={i} className="m-steam" style={t(3.2, i * 1.5)} d="M95 258 q-5 -8 0 -15 q5 -8 0 -15" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />)}
      </g>
    </Frame>
  );
}

/* ---------- 2. Deluxe: golden hour from a balcony ---------- */

function DeluxeScene() {
  const flags = ['#d9534f', '#f0b44c', '#2f8f83', '#f6efdd', '#c2528a', '#f0b44c', '#2f8f83', '#d9534f', '#f6efdd'];
  return (
    <Frame label="Golden hour over deodar forest, seen from a balcony with prayer-flag bunting">
      <Sky id="dlx-sky" stops={[['0', '#f08a5d'], ['0.5', '#f7b97a'], ['1', '#fde3b3']]} />
      <rect width="400" height="300" fill="url(#dlx-sky)" />
      <g transform="translate(200 172)">
        <g className="m-rays">
          {Array.from({ length: 12 }, (_, i) => <path key={i} d="M-5 -34 L0 -120 L5 -34Z" fill="#fff3cf" opacity=".22" transform={`rotate(${i * 30})`} />)}
        </g>
        <circle r="46" fill="url(#glow-warm)" opacity=".95" className="m-glow" style={t(6)} />
        <circle r="26" fill="#fff6dc" />
      </g>
      <Cloud x={70} y={80} fill="#ffe0c8" duration={28} />
      <Cloud x={320} y={60} s={1.2} fill="#ffd5bd" opacity={0.7} duration={34} delay={9} />
      <Peaks far="#d3a58f" mid="#a67c6a" near="#3f5e4c" snow="#fff3e0" snowOpacity={0.85} />
      <ellipse className="m-drift" style={t(20, 3)} cx="260" cy="206" rx="130" ry="8" fill="#ffe6cf" opacity=".5" />
      {Array.from({ length: 11 }, (_, i) => <Pine key={i} x={14 + i * 38} y={258 + (i % 3) * 3} s={1 + (i % 3) * 0.22} fill={i % 2 ? '#2b4a3a' : '#35604a'} delay={i * 0.9} />)}
      <Lodge x={312} y={236} s={0.8} body="#f1dfbd" roof="#8f3f2a" lit="#ffe0a0" smoke="#fff2e0" />
      <Birds y={96} color="#4a2c28" />

      {/* Prayer-flag bunting */}
      <path d="M-6 30 Q200 74 406 24" fill="none" stroke="#5a3a28" strokeWidth="1.6" />
      {flags.map((c, i) => {
        const fx = 20 + i * 42;
        const fy = 36 + Math.sin((i / (flags.length - 1)) * Math.PI) * 24 - i * 0.6;
        return (
          <g key={i} transform={`translate(${fx} ${fy})`}>
            <path className="m-flag" style={t(2.2 + (i % 3) * 0.4, i * 0.3)} d="M0 0 H22 L11 26Z" fill={c} opacity=".95" />
          </g>
        );
      })}

      {/* Balcony */}
      <rect x="0" y="236" width="400" height="64" fill="#7a4e33" />
      <path d="M0 262H400M0 282H400" stroke="#64402a" strokeWidth="2" />
      <rect x="0" y="212" width="400" height="9" rx="2" fill="#5a3a28" />
      {Array.from({ length: 21 }, (_, i) => <rect key={i} x={6 + i * 19.5} y="221" width="4" height="15" fill="#5a3a28" />)}
      <rect x="0" y="236" width="400" height="5" fill="#4a2f1f" />
      {/* Table and tea */}
      <g>
        <ellipse cx="86" cy="262" rx="40" ry="8" fill="#4a2f1f" opacity=".5" />
        <rect x="72" y="248" width="28" height="4" rx="2" fill="#f3ead6" />
        <path d="M78 248 h16 l-2 -11 h-12z" fill="#f3ead6" />
        {[0, 1, 2].map((i) => <path key={i} className="m-steam" style={t(3, i * 1)} d="M86 234 q-5 -8 0 -15 q5 -8 0 -15" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".85" />)}
      </g>
      {/* Chair */}
      <g fill="#3a2a20">
        <path d="M290 280 L298 238 H322 L330 280 H322 L316 248 H304 L298 280Z" />
        <rect x="294" y="250" width="40" height="6" rx="2" />
      </g>
    </Frame>
  );
}

/* ---------- 3. Premium: twilight ridge through floor-to-ceiling glass ---------- */

function PremiumScene() {
  return (
    <Frame label="Twilight over snow peaks and a lit lodge, seen through floor-to-ceiling glass beside a steaming soaking tub">
      <Sky id="prm-sky" stops={[['0', '#1c2a58'], ['0.45', '#5b4a85'], ['0.78', '#d58a86'], ['1', '#f3b98d']]} />
      <rect width="400" height="300" fill="url(#prm-sky)" />
      <Stars points={[[40, 30, 1.6], [96, 58, 1.2], [150, 24, 1.6], [214, 46, 1.2], [268, 22, 1.8], [330, 50, 1.3], [372, 26, 1.5], [22, 90, 1.1], [180, 88, 1.2], [310, 96, 1.1]]} />
      <g className="m-shoot"><path d="M0 0 L-34 14" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".9" /></g>
      <g>
        <circle cx="322" cy="78" r="30" fill="url(#glow-cream)" opacity=".95" className="m-glow" style={t(7)} />
        <circle cx="322" cy="78" r="15" fill="#fff6dc" />
      </g>
      <Cloud x={80} y={118} fill="#f7c8b4" opacity={0.55} duration={32} />
      <Cloud x={280} y={134} s={1.2} fill="#f2b9a4" opacity={0.5} duration={38} delay={14} />
      <Peaks far="#7b6fa0" mid="#4a4b78" near="#232f4a" snow="#fde6dc" snowOpacity={0.88} />
      <Lodge x={92} y={236} s={0.95} body="#d8c4a2" roof="#7a3a38" lit="#ffd27a" smoke="#e6dcf0" smokeOpacity={0.5} />
      {[[34, 258, 1.3], [168, 262, 1.2], [226, 252, 1], [372, 256, 1.4]].map(([x, y, s], i) => <Pine key={x} x={x} y={y} s={s} fill="#16233a" delay={i * 1.1} />)}
      {/* Cable car crossing the ridge */}
      <g>
        <path d="M0 150 L400 108" stroke="#e8dcc6" strokeWidth="1.2" opacity=".7" />
        <g className="m-cable">
          <g transform="translate(0 150)">
            <path d="M0 0 V12" stroke="#e8dcc6" strokeWidth="1.2" />
            <rect x="-9" y="12" width="18" height="12" rx="3" fill="#e3bb72" />
            <rect x="-6" y="15" width="5" height="5" fill="#fff6dc" />
            <rect x="1" y="15" width="5" height="5" fill="#fff6dc" />
          </g>
        </g>
      </g>

      {/* Glass mullions */}
      <path d="M0 0H400V300H0Z M10 10H390V290H10Z" fill="#1c1a2a" fillRule="evenodd" />
      <path d="M135 10V290M265 10V290" stroke="#1c1a2a" strokeWidth="4" />
      <path d="M12 12 L120 12 L12 90Z" fill="#fff" opacity=".07" />
      {/* String lights */}
      <path d="M10 30 Q100 58 200 34 T390 32" fill="none" stroke="#2a2438" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => {
        const bx = 34 + i * 30;
        const by = 40 + Math.sin(i * 0.9) * 5;
        return <circle key={i} className="m-twinkle" cx={bx} cy={by} r="3.4" fill="#ffd98a" style={t(1.8 + (i % 3) * 0.6, i * 0.4)} />;
      })}
      {/* Soaking tub */}
      <g>
        <rect x="0" y="262" width="400" height="38" fill="#14121f" />
        <ellipse cx="200" cy="266" rx="118" ry="22" fill="#2a2d44" />
        <ellipse cx="200" cy="266" rx="106" ry="16" fill="#3b78a0" />
        <path className="m-ripple" d="M120 266 q20 -5 40 0 t40 0 t40 0 t40 0" fill="none" stroke="#bfe2f0" strokeWidth="2" opacity=".7" />
        {[0, 1, 2, 3].map((i) => <path key={i} className="m-steam" style={t(4, i * 1, { '--sxx': `${(i - 1.5) * 6}px` })} d={`M${160 + i * 26} 256 q-6 -10 0 -19 q6 -10 0 -19`} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".6" />)}
      </g>
    </Frame>
  );
}

/* ---------- 4. Suite: aurora, snowfall and a fire inside ---------- */

function SuiteScene() {
  return (
    <Frame label="Snowy peaks under the aurora seen from a suite with a lit fireplace">
      <Sky id="ste-sky" stops={[['0', '#0b1430'], ['0.6', '#1b3358'], ['1', '#3b5f86']]} />
      <rect width="400" height="300" fill="url(#ste-sky)" />
      <Stars points={[[30, 26, 1.4], [84, 54, 1.1], [132, 20, 1.6], [196, 40, 1.2], [250, 24, 1.7], [292, 62, 1.2], [356, 34, 1.4], [60, 100, 1.1], [168, 96, 1.2], [226, 88, 1]]} />
      <g opacity=".7">
        <path className="m-aurora" style={t(14)} d="M-20 90 C60 40 120 120 200 70 S340 40 430 90 V130 C330 90 270 160 190 110 S60 150 -20 130Z" fill="#5fe3b2" opacity=".35" />
        <path className="m-aurora" style={t(19, 6)} d="M-20 110 C70 70 150 140 230 96 S350 70 430 112 V138 C340 108 290 168 210 128 S70 166 -20 142Z" fill="#7aa7ff" opacity=".3" />
      </g>
      <Peaks far="#5d7aa3" mid="#2f4a72" near="#162540" snow="#eaf2ff" snowOpacity={0.95} />
      <Lodge x={310} y={232} s={0.85} body="#c8b896" roof="#6b3030" lit="#ffcf6e" smoke="#cfdcf0" smokeOpacity={0.5} />
      {[[40, 258, 1.4], [92, 262, 1.1], [200, 256, 1.3], [370, 262, 1.2]].map(([x, y, s], i) => <Pine key={x} x={x} y={y} s={s} fill="#0f1c33" delay={i * 1.2} />)}
      <Snowfall count={26} />

      {/* Arched window and the room around it */}
      <path d="M0 0H400V300H0Z M26 270 V120 A100 100 0 0 1 226 120 V270Z" fill="#3a2418" fillRule="evenodd" />
      <path d="M126 22 V270 M26 150 H226" stroke="#3a2418" strokeWidth="5" />
      <rect x="0" y="270" width="400" height="30" fill="#5a3a24" />
      <rect x="0" y="270" width="400" height="4" fill="#7a5236" />
      <path d="M232 0 V270" stroke="#2c1a10" strokeWidth="2" opacity=".5" />
      {/* Fireplace */}
      <g>
        <circle className="m-glow" style={t(3)} cx="312" cy="232" r="84" fill="url(#glow-fire)" opacity=".95" />
        <rect x="262" y="150" width="100" height="120" fill="#6b5a4c" />
        <rect x="254" y="142" width="116" height="12" rx="2" fill="#8a7462" />
        <path d="M278 270 V196 A34 34 0 0 1 346 196 V270Z" fill="#1c0f09" />
        <path className="m-flame" style={t(1.3)} d="M312 266 C290 252 296 230 306 218 C306 232 314 232 316 214 C328 228 336 248 312 266Z" fill="#ff8a2a" />
        <path className="m-flame" style={t(0.9, 0.3)} d="M312 266 C300 258 302 244 310 236 C312 246 318 246 320 234 C328 244 328 258 312 266Z" fill="#ffd05a" />
        <rect x="290" y="262" width="44" height="8" rx="4" fill="#4a2c1a" />
        <rect x="270" y="156" width="14" height="22" rx="2" fill="#c9994a" opacity=".6" />
        <rect x="346" y="156" width="14" height="22" rx="2" fill="#c9994a" opacity=".6" />
      </g>
      {/* Sofa */}
      <g>
        <rect x="40" y="248" width="160" height="30" rx="8" fill="#7a2f33" />
        <rect x="36" y="236" width="168" height="20" rx="8" fill="#8f3a3f" />
        <rect x="54" y="258" width="132" height="6" rx="3" fill="#a64a4f" />
      </g>
    </Frame>
  );
}

const SCENES = {
  standard: StandardScene,
  deluxe: DeluxeScene,
  premium: PremiumScene,
  suite: SuiteScene,
};

export function RoomScene({ scene }: { scene: keyof typeof SCENES }) {
  const Scene = SCENES[scene];
  return <Scene />;
}
