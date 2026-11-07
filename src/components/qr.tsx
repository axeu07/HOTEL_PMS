import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** Error correction M survives a smudged print; the quiet zone is the 4 modules scanners need. */
const QUIET = 4;

export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => qr.isDark(y, x)));
}

/** SVG markup, so the same code can be shown, downloaded and printed. Dark modules are drawn as one path. */
export function qrSvg(text: string, { dark = '#14302a', light = '#ffffff' } = {}): string {
  const m = qrMatrix(text);
  const size = m.length + QUIET * 2;
  let d = '';
  m.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) { x++; continue; }
      const start = x;
      while (x < row.length && row[x]) x++;
      d += `M${start + QUIET} ${y + QUIET}h${x - start}v1h-${x - start}z`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

export function QrCode({ value, label, className = '', testId = 'review-qr' }: { value: string; label: string; className?: string; testId?: string }) {
  const svg = useMemo(() => qrSvg(value), [value]);
  const src = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, [svg]);
  return <img className={`qr-code ${className}`} src={src} alt={label} data-testid={testId} data-url={value} />;
}

/** Renders the code to a PNG at `px` pixels square and saves it. */
export function downloadQrPng(value: string, filename: string, px = 1024) {
  const url = URL.createObjectURL(new Blob([qrSvg(value)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, px, px);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(png);
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  };
  img.src = url;
}
