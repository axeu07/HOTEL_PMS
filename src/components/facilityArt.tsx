import type { CSSProperties, ReactElement } from 'react';
import type { FacilityKey } from '@/data/site';

/**
 * Small looping vignettes for the Facilities band, each a hotel detail set against the mountains:
 * steaming dishes, a spa pool, string lights, a fireplace, a bobbing boat and rising lanterns.
 * Motion classes live in styles/landing-motion.css.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>;
const t = (duration: number, delay = 0, extra: Vars = {}): Vars => ({ animationDuration: `${duration}s`, animationDelay: `${-delay}s`, ...extra });

const BG = {
  night: '#16253f',
  warm: '#4a3322',
};

function Backdrop({ fill, far = '#3f7664', near = '#1c4036', stars = false }: { fill: string; far?: string; near?: string; stars?: boolean }) {
  return (
    <>
      <rect width="240" height="150" fill={fill} />
      {stars &&
        [[28, 22], [70, 12], [120, 26], [176, 14], [214, 30], [150, 44]].map(([x, y], i) => (
          <circle key={x} className="m-twinkle" cx={x} cy={y} r="1.5" fill="#fff6dc" style={t(2.4 + (i % 3) * 0.7, i * 0.6)} />
        ))}
      <path d="M0 96 L38 58 L62 80 L104 36 L148 84 L176 62 L214 90 L240 74 V150 H0Z" fill={far} />
      <path d="M104 36 L90 56 L98 52 L105 58 L112 51 L119 56Z" fill="#fff" opacity=".85" />
      <path d="M0 116 C50 100 90 122 140 108 S210 104 240 116 V150 H0Z" fill={near} />
    </>
  );
}

function Steam({ x, y, count = 3, stroke = '#fff' }: { x: number; y: number; count?: number; stroke?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <path key={i} className="m-steam" style={t(3.4, i * 1.1)} d={`M${x + i * 9 - ((count - 1) * 9) / 2} ${y} q-5 -8 0 -15 q5 -8 0 -15`} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity=".8" />
      ))}
    </>
  );
}

const ART: Record<FacilityKey, () => ReactElement> = {
  /* A table in the durbar hall: steaming dishes under warm lamps. */
  saffron: () => (
    <>
      <Backdrop fill={BG.warm} far="#6a4a30" near="#2a1b12" />
      {[60, 120, 180].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 0 V24`} stroke="#c9994a" strokeWidth="1.5" />
          <path className="m-sway" style={t(4, i)} d={`M${x - 14} 40 a14 16 0 0 1 28 0z`} fill="#f3ead6" />
          <circle className="m-glow" style={t(3, i * 0.7)} cx={x} cy="44" r="16" fill="url(#glow-warm)" opacity=".95" />
        </g>
      ))}
      <rect y="112" width="240" height="38" fill="#7c5234" />
      {[70, 170].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="110" rx="30" ry="7" fill="#f3ead6" />
          <path d={`M${x - 26} 110 q26 18 52 0 v6 h-52z`} fill="#e3d6b6" />
          <circle cx={x - 9} cy="107" r="5" fill="#b4583a" />
          <circle cx={x + 9} cy="107" r="5" fill="#c9994a" />
          <Steam x={x} y={98} />
        </g>
      ))}
    </>
  ),

  /* A still spa pool with a lotus and drifting steam. */
  spa: () => (
    <>
      <Backdrop fill="#3d6c68" far="#5b8f87" near="#24504a" />
      <circle className="m-glow" style={t(6)} cx="120" cy="52" r="26" fill="url(#glow-cream)" opacity=".95" />
      <rect y="100" width="240" height="50" fill="#4d8a8c" />
      <g fill="none" stroke="#bfe2dc" strokeWidth="2" strokeLinecap="round" opacity=".85">
        {[0, 1, 2].map((i) => <ellipse key={i} className="m-ring" style={t(4.2, i * 1.4)} cx="120" cy="116" rx="26" ry="6" />)}
        <path className="m-ripple" d="M20 132 q12 -4 24 0 t24 0 M156 138 q12 -4 24 0 t24 0" />
      </g>
      <g className="m-bob" style={t(5)}>
        <ellipse cx="120" cy="114" rx="22" ry="5" fill="#f3ead6" />
        <path d="M120 112 c-12 -9 -13 -22 0 -30 c13 8 12 21 0 30z" fill="#e8a08a" />
        <path d="M120 112 c-20 -2 -26 -12 -25 -19 c13 1 22 8 25 19z" fill="#f0b9a4" />
        <path d="M120 112 c20 -2 26 -12 25 -19 c-13 1 -22 8 -25 19z" fill="#f0b9a4" />
      </g>
      <Steam x={50} y={104} count={2} />
      <Steam x={190} y={106} count={2} />
    </>
  ),

  /* Long Terrace at blue hour: string lights twinkling over the hills. */
  terrace: () => (
    <>
      <Backdrop fill={BG.night} far="#2c4568" near="#0f1d33" stars />
      <circle cx="196" cy="30" r="11" fill="#f6e8c5" />
      <path d="M0 30 Q60 62 120 36 T240 34" fill="none" stroke="#0b1424" strokeWidth="1.5" />
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} className="m-twinkle" cx={14 + i * 26.5} cy={44 + Math.sin(i * 1.1) * 7} r="4" fill="#ffd98a" style={t(1.6 + (i % 3) * 0.6, i * 0.35)} />
      ))}
      <rect y="112" width="240" height="38" fill="#5c3d28" />
      {[52, 170].map((x) => (
        <g key={x}>
          <rect x={x - 26} y="94" width="52" height="5" rx="2" fill="#f3ead6" />
          <rect x={x - 2} y="99" width="4" height="26" fill="#f3ead6" />
          <rect className="m-flicker" style={t(2.6, x / 40)} x={x - 4} y="84" width="8" height="10" rx="2" fill="#ffd98a" />
        </g>
      ))}
    </>
  ),

  /* Reading Room: fireplace flames and a drift of dust in the light. */
  reading: () => (
    <>
      <rect width="240" height="150" fill="#1f2f2a" />
      {[26, 62].map((y, row) => (
        <g key={y}>
          <rect x="0" y={y + 22} width="240" height="4" fill="#c9994a" />
          {Array.from({ length: 12 }, (_, i) => {
            const colors = ['#b4583a', '#f3ead6', '#6f8f7c', '#c9994a', '#d99a7c', '#5f8f92'];
            const h = 14 + ((i * 7 + row * 5) % 9);
            return <rect key={i} x={8 + i * 19.5} y={y + 22 - h} width="14" height={h} fill={colors[(i + row * 2) % colors.length]} />;
          })}
        </g>
      ))}
      <rect y="116" width="240" height="34" fill="#5c3d28" />
      <rect x="76" y="76" width="88" height="48" fill="#6b5a4c" />
      <rect x="70" y="70" width="100" height="8" rx="2" fill="#8a7462" />
      <path d="M88 124 V100 A32 28 0 0 1 152 100 V124Z" fill="#1c0f09" />
      <circle className="m-glow" style={t(2.6)} cx="120" cy="106" r="44" fill="url(#glow-fire)" opacity=".95" />
      <path className="m-flame" style={t(1.2)} d="M120 122 C100 112 104 96 112 88 C112 98 118 98 120 86 C130 96 138 110 120 122Z" fill="#ff8a2a" />
      <path className="m-flame" style={t(0.85, 0.3)} d="M120 122 C110 116 112 106 118 100 C120 107 124 107 126 98 C132 106 132 116 120 122Z" fill="#ffd05a" />
      {[[40, 90, 0], [190, 80, 2], [30, 52, 4], [206, 100, 1]].map(([x, y, d]) => (
        <circle key={`${x}${y}`} className="m-mote" cx={x} cy={y} r="1.6" fill="#ffe7a8" style={t(7, d)} />
      ))}
    </>
  ),

  /* Boathouse: a rowing boat bobbing under the mountains at dawn. */
  boathouse: () => (
    <>
      <Backdrop fill="#f0c9a0" far="#8d9fb0" near="#4f7f7c" />
      <circle className="m-glow" style={t(6)} cx="62" cy="52" r="22" fill="url(#glow-warm)" opacity=".95" />
      <circle cx="62" cy="52" r="12" fill="#fff6dc" />
      <rect y="96" width="240" height="54" fill="#5f8f92" />
      <g fill="none" stroke="#bfe2dc" strokeWidth="2" strokeLinecap="round" opacity=".85">
        <path className="m-ripple" d="M10 112 q14 -5 28 0 t28 0 M150 108 q14 -5 28 0 t28 0 M40 134 q14 -5 28 0 t28 0 M130 138 q14 -5 28 0 t28 0" />
      </g>
      <g className="m-bob" style={t(3.6)}>
        <path d="M88 106 h70 l-12 16 h-46z" fill="#b4583a" />
        <path d="M122 106 V64 l30 38z" fill="#f3ead6" />
        <path d="M122 106 V60" stroke="#3a2a20" strokeWidth="2" />
      </g>
      <path d="M0 150 V122 h46 v28z" fill="#3a2a20" />
      <rect x="0" y="116" width="52" height="6" fill="#c9994a" />
    </>
  ),

  /* Weddings & gatherings: lanterns rising over the courtyard. */
  events: () => (
    <>
      <Backdrop fill="#2d2a55" far="#4b4a7c" near="#1a1d3a" stars />
      {[[44, 96, 0, 1], [92, 110, 2.5, 0.8], [140, 100, 5, 1.1], [190, 112, 1.3, 0.9], [118, 118, 3.8, 0.7]].map(([x, y, d, s], i) => (
        <g key={i} className="m-lantern" style={t(9 + i, d)}>
          <g transform={`translate(${x} ${y}) scale(${s})`}>
            <circle r="16" fill="#ffb347" opacity=".25" />
            <path d="M-8 -9 H8 L10 7 H-10Z" fill="#ffc55e" />
            <rect x="-6" y="7" width="12" height="3" fill="#b4583a" />
            <path d="M-8 -9 q8 -6 16 0" fill="none" stroke="#b4583a" strokeWidth="2" />
          </g>
        </g>
      ))}
      <rect y="124" width="240" height="26" fill="#2a2130" />
      {[30, 70, 110, 150, 190].map((x, i) => (
        <path key={x} d={`M${x} 124 v-14 a8 8 0 0 1 16 0 v14z`} fill="#f3ead6" className="m-flicker" style={t(3 + (i % 2), i * 0.6)} opacity=".9" />
      ))}
    </>
  ),
};

export function FacilityArt({ name, title }: { name: FacilityKey; title: string }) {
  const Art = ART[name];
  return (
    <svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label={title} className="facility-art">
      <Art />
    </svg>
  );
}
