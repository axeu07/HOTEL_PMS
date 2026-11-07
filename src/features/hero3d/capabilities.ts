/** Decides, before downloading any 3D code, how much of the hero this device should get. */

export type HeroTier = 'high' | 'low' | 'static';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export const reducedMotionQuery = () => window.matchMedia(REDUCED_MOTION);

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** A software rasteriser can technically run WebGL, but never at a usable frame rate. */
function usableWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
}

export function detectHeroTier(): HeroTier {
  // Development-only override, for capturing the poster and testing each tier.
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(window.location.search).get('hero');
    if (forced === 'high' || forced === 'low' || forced === 'static') return forced;
  }

  const hints = navigator as Navigator & NavigatorHints;
  if (reducedMotionQuery().matches) return 'static';
  if (hints.connection?.saveData) return 'static';
  if ((hints.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 2) return 'static';
  if (!usableWebGL()) return 'static';

  const touchFirst = window.matchMedia('(pointer: coarse)').matches;
  return touchFirst || window.innerWidth < 900 ? 'low' : 'high';
}
