import { useId } from 'react';

/*
 * The painted parts of the HOTEL PMS look. Lightweight inline SVG, coloured from tokens so each
 * theme gets its own version. All decorative: hidden from assistive technology, never hit-tested,
 * and left out of print.
 */

/** Soft hills behind the page heading. Stronger on the dashboard's welcome than on working pages. */
export function HeaderWaves({ soft }: { soft?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={`page-waves no-print ${soft ? 'soft' : ''}`} viewBox="0 0 900 180" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--wave-1)" stopOpacity="0.75" />
          <stop offset="1" stopColor="var(--wave-1)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--wave-2)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--wave-2)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--wave-3)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--wave-3)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}a)`} d="M0 170C110 158 190 118 300 88 400 62 470 12 560 16 660 20 720 84 900 58V180H0Z" />
      <path fill={`url(#${id}b)`} d="M120 180C240 160 330 112 430 92 520 74 580 54 650 70 730 88 800 118 900 104V180Z" />
      <path fill={`url(#${id}c)`} d="M260 180C380 164 470 136 570 126 680 116 780 148 900 136V180Z" />
    </svg>
  );
}

/** Each leaf: where it joins the stem, its angle and its length relative to the drawn leaf. */
const LEAVES: { x: number; y: number; angle: number; scale: number; soft?: boolean }[] = [
  { x: 40, y: 118, angle: -158, scale: 1.05 },
  { x: 41, y: 112, angle: -28, scale: 1.1, soft: true },
  { x: 45, y: 92, angle: -150, scale: 1, soft: true },
  { x: 47, y: 86, angle: -22, scale: 1.05 },
  { x: 52, y: 66, angle: -142, scale: 0.9 },
  { x: 55, y: 60, angle: -18, scale: 0.92, soft: true },
  { x: 61, y: 42, angle: -128, scale: 0.74, soft: true },
  { x: 64, y: 37, angle: -22, scale: 0.72 },
  { x: 70, y: 22, angle: -72, scale: 0.68 },
];

/** Rolling land and a leafy stem at the foot of the sidebar. Sits behind the navigation. */
export function SidebarScenery() {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="sidebar-scenery no-print" viewBox="0 0 240 190" preserveAspectRatio="xMinYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--hill-far)" stopOpacity="0.85" />
          <stop offset="1" stopColor="var(--hill-far)" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`${id}mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--hill-mid)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--hill-mid)" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${id}near`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hill-near)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--hill-near)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}far)`} d="M0 118C44 92 92 86 138 104 178 120 208 112 240 92V190H0Z" />
      <path fill={`url(#${id}mid)`} d="M0 156C50 132 104 116 158 124 192 129 218 124 240 112V190H0Z" />
      <path fill={`url(#${id}near)`} d="M0 176C56 158 112 152 160 164 194 172 220 170 240 160V190H0Z" />
      <g transform="translate(-6 44)">
        <path d="M34 150C36 110 46 62 74 16" fill="none" stroke="var(--leaf)" strokeWidth="1.5" strokeLinecap="round" />
        {LEAVES.map((leaf) => (
          <g key={`${leaf.x}${leaf.y}`} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle}) scale(${leaf.scale})`}>
            <path d="M0 0C9-11 26-13 40-1 27 8 10 8 0 0Z" fill={leaf.soft ? 'var(--leaf-soft)' : 'var(--leaf)'} />
            <path d="M2 0C13-2 25-2 36-1" fill="none" stroke="var(--leaf-vein)" strokeWidth="0.6" strokeOpacity="0.8" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export type StatArt = 'building' | 'curve';

/** The quiet picture in the corner of a metric card. */
export function StatCardArt({ art }: { art: StatArt }) {
  const id = useId().replace(/:/g, '');
  if (art === 'curve') {
    return (
      <svg className="stat-art" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--tone-soft)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--wave-2)" stopOpacity="0.38" />
          </linearGradient>
        </defs>
        <path fill={`url(#${id})`} d="M0 90C40 72 70 34 112 26 134 22 150 26 160 30V90Z" />
      </svg>
    );
  }
  const floors = [22, 36, 50, 64, 78];
  const bays = [58, 74, 90, 106];
  return (
    <svg className="stat-art stat-art-building" viewBox="0 0 150 100" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--art-tone)" stopOpacity="0.12" />
          <stop offset="0.65" stopColor="var(--art-tone)" stopOpacity="0.72" />
          <stop offset="1" stopColor="var(--art-tone)" stopOpacity="0.92" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M44 100V18l74-12 26 14v80Z" />
      <path fill="var(--art-tone)" fillOpacity="0.55" d="M118 6l26 14v80h-26Z" />
      {floors.flatMap((y) =>
        bays.map((x) => <rect key={`${x}${y}`} x={x} y={y - (x - 44) * 0.14} width="9" height="8" rx="1" fill="var(--art-line)" fillOpacity="0.75" />),
      )}
    </svg>
  );
}

export type KpiArtKind = 'finance' | 'rooms' | 'guests' | 'property';

/** Faint layered scenery behind a dashboard KPI panel. Purely decorative; colours come from tokens. */
export function KpiPanelArt({ kind }: { kind: KpiArtKind }) {
  return (
    <svg className={`kpi-art kpi-art-${kind}`} viewBox="0 0 260 140" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      {kind === 'finance' && (
        <>
          <path d="M0 120 C40 112 60 92 100 96 S160 62 200 48 S240 36 260 28 L260 140 L0 140 Z" fill="var(--champagne)" opacity=".16" />
          <path d="M0 128 C50 122 80 106 120 108 S180 82 220 70 S250 62 260 56 L260 140 L0 140 Z" fill="var(--sage)" opacity=".18" />
          <path d="M10 112 L60 96 L100 104 L150 66 L200 56 L250 26" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".38" />
          <circle cx="250" cy="26" r="4" fill="var(--gold)" opacity=".6" />
        </>
      )}
      {kind === 'rooms' && (
        <>
          <g fill="var(--sage)" opacity=".2">
            <rect x="150" y="60" width="44" height="60" rx="5" />
            <rect x="200" y="36" width="44" height="84" rx="5" />
            <rect x="100" y="84" width="44" height="36" rx="5" />
          </g>
          <g fill="var(--surface)" opacity=".85">
            <rect x="160" y="72" width="10" height="10" rx="2" /><rect x="176" y="72" width="10" height="10" rx="2" />
            <rect x="210" y="48" width="10" height="10" rx="2" /><rect x="226" y="48" width="10" height="10" rx="2" />
            <rect x="210" y="66" width="10" height="10" rx="2" /><rect x="226" y="66" width="10" height="10" rx="2" />
          </g>
          <path d="M96 124 H250" stroke="var(--champagne)" strokeWidth="2" opacity=".5" strokeLinecap="round" />
        </>
      )}
      {kind === 'guests' && (
        <>
          <path d="M0 110 C40 90 80 130 130 108 S210 84 260 100 L260 140 L0 140 Z" fill="var(--sage)" opacity=".18" />
          <path d="M0 124 C50 106 90 140 140 122 S220 100 260 114 L260 140 L0 140 Z" fill="var(--champagne)" opacity=".2" />
          <path d="M120 70 C140 40 190 40 210 70" fill="none" stroke="var(--accent)" strokeWidth="2" opacity=".28" strokeLinecap="round" />
          <circle cx="165" cy="44" r="5" fill="var(--accent)" opacity=".25" />
        </>
      )}
      {kind === 'property' && (
        <>
          <g fill="var(--sage)" opacity=".2">
            <rect x="120" y="70" width="36" height="60" rx="3" />
            <rect x="162" y="30" width="46" height="100" rx="3" />
            <rect x="214" y="58" width="34" height="72" rx="3" />
          </g>
          <g fill="var(--accent)" opacity=".14">
            <path d="M162 30 L185 14 L208 30 Z" />
          </g>
          <g fill="var(--surface)" opacity=".85">
            <rect x="172" y="44" width="8" height="8" rx="1.5" /><rect x="190" y="44" width="8" height="8" rx="1.5" />
            <rect x="172" y="62" width="8" height="8" rx="1.5" /><rect x="190" y="62" width="8" height="8" rx="1.5" />
            <rect x="172" y="80" width="8" height="8" rx="1.5" /><rect x="190" y="80" width="8" height="8" rx="1.5" />
          </g>
          <path d="M100 130 H256" stroke="var(--champagne)" strokeWidth="2" opacity=".55" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
