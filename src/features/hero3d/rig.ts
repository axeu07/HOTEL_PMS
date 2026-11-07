/**
 * Plain mutable state shared between the DOM layer (pointer, GSAP) and the WebGL
 * frame loop, so moving the cursor or scrolling never causes a React render.
 */
export interface HeroRig {
  /** Cursor position, -1 to 1 on each axis. */
  pointerX: number;
  pointerY: number;
  /** 0 at load, 1 when the opening camera move has finished. */
  intro: number;
  /** 0 at the top of the page, 1 when the hero has scrolled away. */
  scroll: number;
}

export const createRig = (): HeroRig => ({ pointerX: 0, pointerY: 0, intro: 0, scroll: 0 });
