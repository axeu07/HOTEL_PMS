import type { ReactNode } from 'react';

/**
 * Original illustration library for the fictional hotel. Everything is vector and
 * bundled, so the demo needs no image hosting. Swap for a client's real
 * photography by replacing <Art /> with an <img> in the public site.
 */

const INK = '#14302a';
const PINE = '#1f4339';
const SAGE = '#6f8f7c';
const MIST = '#c9d3c1';
const CREAM = '#f3ead6';
const SAND = '#e3d2ad';
const BRASS = '#c9994a';
const CLAY = '#b4583a';
const ROSE = '#d99a7c';
const WATER = '#5f8f92';

function Hills({ dusk = false }: { dusk?: boolean }) {
  return (
    <>
      <path d="M0 330 C120 250 200 290 300 240 S500 170 620 240 S760 300 800 270 V600 H0Z" fill={dusk ? '#5d7a78' : MIST} />
      <path d="M0 390 C140 320 260 370 400 320 S640 300 800 360 V600 H0Z" fill={dusk ? PINE : SAGE} />
    </>
  );
}

function Deodar({ x, y, s = 1, fill = INK }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <path d="M0 -120 L26 -72 L14 -74 L38 -30 L20 -32 L48 14 L-48 14 L-20 -32 L-38 -30 L-14 -74 L-26 -72Z" />
      <rect x="-5" y="14" width="10" height="22" />
    </g>
  );
}

function Arch({ x, y, w, h, fill, opacity }: { x: number; y: number; w: number; h: number; fill: string; opacity?: string }) {
  const r = w / 2;
  return <path d={`M${x} ${y + h} V${y + r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h}Z`} fill={fill} opacity={opacity} />;
}

const SCENES: Record<string, ReactNode> = {
  hero: (
    <>
      <rect width="800" height="600" fill="#e9b98d" />
      <circle cx="560" cy="170" r="66" fill="#f6dfb7" />
      <Hills dusk />
      <rect y="400" width="800" height="200" fill={WATER} />
      <path d="M120 440h180M430 470h240M240 510h300M60 545h160M600 540h140" stroke="#a6c4c1" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <path d="M520 420 q40 8 80 0" stroke={CREAM} strokeWidth="5" fill="none" opacity=".55" />
      <Deodar x={100} y={370} s={1.1} />
      <Deodar x={40} y={392} s={0.8} />
      <Deodar x={716} y={372} s={1.25} />
      <g>
        <rect x="190" y="230" width="430" height="190" fill={CREAM} />
        <rect x="170" y="218" width="470" height="14" fill={CLAY} />
        <path d="M160 218 L405 150 L650 218Z" fill={CLAY} />
        {[215, 295, 375, 455, 535].map((x) => (
          <g key={x}>
            <Arch x={x} y={262} w={60} h={158} fill={INK} />
            <Arch x={x + 8} y={280} w={44} h={140} fill={BRASS} opacity=".85" />
          </g>
        ))}
      </g>
      <rect y="418" x="150" width="510" height="10" fill={SAND} />
      <path d="M150 428 h510 l22 16 h-554z" fill="#cdbb95" />
    </>
  ),
  courtyard: (
    <>
      <rect width="800" height="600" fill={CREAM} />
      <rect y="440" width="800" height="160" fill={SAND} />
      <path d="M0 500h800M0 550h800M120 440L60 600M320 440l-30 160M480 440l30 160M680 440l60 160" stroke="#cdbb95" strokeWidth="2" />
      {[60, 280, 500].map((x) => (
        <g key={x}>
          <Arch x={x} y={150} w={200} h={290} fill={PINE} />
          <Arch x={x + 18} y={170} w={164} h={270} fill={MIST} />
          <Deodar x={x + 100} y={380} s={0.9} fill={SAGE} />
        </g>
      ))}
      <rect x="0" y="118" width="800" height="24" fill={CLAY} />
      <circle cx="400" cy="500" r="56" fill="#fff" opacity=".35" />
      <circle cx="400" cy="500" r="36" fill={WATER} />
      <path d="M650 440 c-16 -50 10 -70 26 -96 c10 30 28 50 10 96z" fill={SAGE} />
      <rect x="648" y="438" width="42" height="34" fill={CLAY} />
    </>
  ),
  garden: (
    <>
      <rect width="800" height="600" fill="#dfe6cd" />
      <Hills />
      <Deodar x={150} y={420} s={1.5} fill={PINE} />
      <Deodar x={330} y={450} s={1.1} fill={INK} />
      <Deodar x={640} y={410} s={1.7} fill={PINE} />
      <rect y="470" width="800" height="130" fill={SAGE} />
      <path d="M380 600 C400 540 440 520 420 470 h40 C480 520 450 560 470 600Z" fill={SAND} />
      <g fill={ROSE}>
        {[60, 110, 170, 230, 560, 620, 690, 740].map((x, i) => <circle key={x} cx={x} cy={520 + (i % 3) * 18} r="9" />)}
      </g>
      <rect x="520" y="400" width="130" height="10" fill={CLAY} />
      <rect x="530" y="410" width="8" height="70" fill={INK} />
      <rect x="632" y="410" width="8" height="70" fill={INK} />
    </>
  ),
  lake: (
    <>
      <rect width="800" height="600" fill="#f2d7b2" />
      <circle cx="240" cy="150" r="56" fill="#fbecd1" />
      <Hills dusk />
      <rect y="360" width="800" height="240" fill={WATER} />
      <path d="M100 410h220M420 390h200M180 460h340M560 480h170M40 520h220M380 540h300" stroke="#a6c4c1" strokeWidth="3" strokeLinecap="round" opacity=".75" />
      <path d="M470 440 h120 l-16 22 h-88z" fill={CLAY} />
      <path d="M528 440 V378 l42 56z" fill={CREAM} />
      <path d="M0 600 V500 h170 v100z" fill={INK} />
      <rect x="0" y="470" width="190" height="10" fill={BRASS} />
      <path d="M20 470v30M60 470v30M100 470v30M140 470v30M180 470v30" stroke={BRASS} strokeWidth="5" />
    </>
  ),
  suite: (
    <>
      <rect width="800" height="600" fill={CREAM} />
      <rect y="460" width="800" height="140" fill="#b98d5e" />
      <path d="M0 500h800M0 545h800" stroke="#a37a4e" strokeWidth="2" />
      <Arch x={70} y={100} w={220} h={360} fill={INK} />
      <Arch x={88} y={120} w={184} h={340} fill="#efc69a" />
      <circle cx="180" cy="240" r="30" fill="#fbecd1" />
      <path d="M88 350 q92 -60 184 0 V460 H88z" fill={WATER} />
      <rect x="360" y="330" width="360" height="110" rx="14" fill={PINE} />
      <rect x="360" y="290" width="360" height="70" rx="14" fill={INK} />
      <rect x="388" y="306" width="96" height="50" rx="8" fill={BRASS} />
      <rect x="500" y="306" width="96" height="50" rx="8" fill={CREAM} />
      <rect x="612" y="306" width="84" height="50" rx="8" fill={CLAY} />
      <rect x="380" y="440" width="16" height="30" fill={INK} />
      <rect x="684" y="440" width="16" height="30" fill={INK} />
      <path d="M540 80 v90" stroke={BRASS} strokeWidth="3" />
      <path d="M500 170 h80 l18 42 h-116z" fill={BRASS} />
    </>
  ),
  residence: (
    <>
      <rect width="800" height="600" fill="#b6532f" />
      <circle cx="600" cy="170" r="84" fill="#f6c889" />
      <path d="M0 340 C160 260 280 300 420 250 S680 230 800 300 V600 H0Z" fill="#6e4034" />
      <rect y="370" width="800" height="230" fill="#7a5e5e" />
      <path d="M520 400h170M480 440h260M560 490h130" stroke="#f6c889" strokeWidth="4" strokeLinecap="round" opacity=".6" />
      <rect y="440" width="800" height="16" fill={CREAM} />
      <path d="M40 456v144M140 456v144M240 456v144M340 456v144" stroke={CREAM} strokeWidth="10" />
      <rect y="520" width="800" height="80" fill={INK} opacity=".75" />
      <rect x="90" y="330" width="210" height="10" fill={INK} />
      <rect x="185" y="340" width="16" height="100" fill={INK} />
      <path d="M185 330 V230 M135 230 h100 l-50 -60z" stroke={INK} fill={CLAY} strokeWidth="6" />
    </>
  ),
  restaurant: (
    <>
      <rect width="800" height="600" fill="#2a3b34" />
      <Arch x={60} y={90} w={190} h={370} fill="#e8b163" />
      <Arch x={305} y={90} w={190} h={370} fill="#e8b163" />
      <Arch x={550} y={90} w={190} h={370} fill="#e8b163" />
      {[155, 400, 645].map((x) => (
        <g key={x}>
          <path d={`M${x} 0v210`} stroke={INK} strokeWidth="3" />
          <path d={`M${x - 34} 250 a34 40 0 0 1 68 0z`} fill={CREAM} />
          <circle cx={x} cy={252} r="9" fill="#fff4cf" />
        </g>
      ))}
      <rect y="460" width="800" height="140" fill="#7c5234" />
      {[155, 400, 645].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={438} rx="88" ry="20" fill={CREAM} />
          <path d={`M${x - 80} 440 q80 42 160 0 v30 h-160z`} fill={CREAM} />
          <circle cx={x - 28} cy={430} r="9" fill={CLAY} />
          <circle cx={x + 28} cy={430} r="9" fill={BRASS} />
        </g>
      ))}
    </>
  ),
  spa: (
    <>
      <rect width="800" height="600" fill="#d7ded0" />
      <Arch x={250} y={60} w={300} h={350} fill="#f3e9d2" />
      <circle cx="400" cy="210" r="88" fill={ROSE} opacity=".8" />
      <rect y="400" width="800" height="200" fill={WATER} />
      <path d="M140 440h170M480 445h190M260 490h290M90 545h180M520 540h210" stroke="#b7d0cc" strokeWidth="3" strokeLinecap="round" />
      <g fill={CREAM}>
        <ellipse cx="400" cy="402" rx="60" ry="12" />
        <path d="M400 395 c-26 -18 -28 -44 0 -62 c28 18 26 44 0 62z" fill={ROSE} />
        <path d="M400 396 c-44 -6 -58 -28 -56 -44 c28 2 48 16 56 44z" fill="#e7b39a" />
        <path d="M400 396 c44 -6 58 -28 56 -44 c-28 2 -48 16 -56 44z" fill="#e7b39a" />
      </g>
      <Deodar x={100} y={370} s={1.1} fill={SAGE} />
      <Deodar x={700} y={370} s={1.1} fill={SAGE} />
    </>
  ),
  terrace: (
    <>
      <rect width="800" height="600" fill="#20354f" />
      <g fill="#f6e8c5">
        {[[80, 80], [210, 50], [340, 110], [510, 60], [640, 120], [740, 50], [150, 160], [430, 170], [700, 190]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.5" />)}
      </g>
      <circle cx="630" cy="100" r="34" fill="#f6e8c5" />
      <path d="M0 310 C180 240 300 290 460 240 S700 260 800 310 V600 H0Z" fill="#132233" />
      <rect y="360" width="800" height="240" fill="#1a2d44" />
      <path d="M0 150 q200 80 400 30 t400 20" fill="none" stroke={INK} strokeWidth="3" />
      {[70, 170, 280, 390, 500, 610, 720].map((x, i) => <circle key={x} cx={x} cy={186 + (i % 2) * 12} r="8" fill="#ffd98a" />)}
      <rect y="470" width="800" height="130" fill="#7c5234" />
      <rect x="110" y="400" width="200" height="10" fill={CREAM} />
      <rect x="205" y="410" width="10" height="90" fill={CREAM} />
      <rect x="500" y="400" width="200" height="10" fill={CREAM} />
      <rect x="595" y="410" width="10" height="90" fill={CREAM} />
    </>
  ),
  library: (
    <>
      <rect width="800" height="600" fill={INK} />
      {[110, 240, 370].map((y, row) => (
        <g key={y}>
          <rect x="0" y={y + 90} width="800" height="10" fill={BRASS} />
          {Array.from({ length: 26 }, (_, i) => {
            const colors = [CLAY, CREAM, SAGE, BRASS, ROSE, WATER];
            const h = 58 + ((i * 7 + row * 5) % 30);
            return <rect key={i} x={20 + i * 30} y={y + 90 - h} width={24} height={h} fill={colors[(i + row * 2) % colors.length]} />;
          })}
        </g>
      ))}
      <rect y="480" width="800" height="120" fill="#7c5234" />
      <path d="M270 480 v-100 a60 60 0 0 1 120 0 v100z" fill={CLAY} />
      <rect x="290" y="420" width="240" height="60" rx="10" fill={CLAY} />
    </>
  ),
  lobby: (
    <>
      <rect width="800" height="600" fill={CREAM} />
      <rect y="470" width="800" height="130" fill="#ece1c5" />
      <path d="M0 470L800 470M100 470L0 600M260 470l-80 130M400 470v130M540 470l80 130M700 470l100 130" stroke="#d3c49f" strokeWidth="2" />
      <Arch x={250} y={70} w={300} h={400} fill={PINE} />
      <Arch x={280} y={100} w={240} h={370} fill="#efc69a" />
      <path d="M280 370 C340 330 450 330 520 380 V470 H280Z" fill={WATER} />
      <rect x="120" y="150" width="60" height="320" fill={SAND} />
      <rect x="620" y="150" width="60" height="320" fill={SAND} />
      <path d="M400 0v60" stroke={BRASS} strokeWidth="4" />
      <circle cx="400" cy="66" r="14" fill={BRASS} />
      <rect x="30" y="420" width="62" height="50" fill={CLAY} />
      <path d="M30 420 c-10 -70 20 -90 31 -120 c12 30 40 50 31 120z" fill={SAGE} />
      <rect x="708" y="420" width="62" height="50" fill={CLAY} />
      <path d="M708 420 c-10 -70 20 -90 31 -120 c12 30 40 50 31 120z" fill={SAGE} />
    </>
  ),
};

export type ArtName = keyof typeof SCENES;

export function Art({ name, title, slice = true }: { name: string; title: string; slice?: boolean }) {
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio={slice ? 'xMidYMid slice' : 'xMidYMid meet'} role="img" aria-label={title} style={{ width: '100%', height: '100%' }}>
      {SCENES[name] ?? SCENES.courtyard}
    </svg>
  );
}
