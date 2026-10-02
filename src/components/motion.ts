import type { Transition } from "framer-motion";

// Every animation value in the app lives here.

export const STACK = {
  /** Seeded resting pose range for each paper in the pile */
  maxTiltDeg: 4,
  maxOffsetX: 14,
  maxOffsetY: 10,

  /** Pick-up: the paper rises and its right edge tips toward the viewer */
  liftScale: 1.04,
  liftY: 22,
  liftRotateY: -12,
  liftRotateX: 5,
  perspective: 1400,

  /** Carry: the paper is set aside to this side (-1 left, 1 right) */
  carrySide: -1,
  /** How far a paper is carried sideways, as a fraction of paper width */
  awayX: 0.58,
  awayY: 30,
  awayTiltDeg: 8,
  awayRotateY: -18,

  /** Input unlocks this long into the landing; the spring's tail plays out underneath */
  settleLockMs: 420,

  /** Opacity of the shade laid over papers below the top one */
  lowerShade: 0.55,
} as const;

/**
 * The bend where the paper is held. The right part of the sheet is cut into
 * strips that hinge off each other, each turning a little more than the last,
 * so the paper curves up toward the hand holding its right edge.
 */
export const CURL = {
  /** Share of the paper width that bends */
  region: 0.42,
  segments: 10,
  /** Total turn at the very edge when fully bent */
  edgeDeg: 58,
  perspective: 1100,
  /** Highlight on the outermost strip when fully bent; strips between ramp up to it */
  edgeLight: 0.16,
  /** How much the paper bends in each phase (0 flat, 1 fully bent) */
  bend: { lift: 1, away: 0.8 },
} as const;

export const SHADOW = {
  rest: "0px 2px 3px rgba(0,0,0,0.45), 0px 10px 22px rgba(0,0,0,0.35)",
  lifted: "0px 18px 28px rgba(0,0,0,0.4), 0px 44px 90px rgba(0,0,0,0.55)",
} as const;

export const EASE = {
  lift: [0.2, 0.7, 0.3, 1],
  drift: [0.45, 0, 0.25, 1],
} as const;

export const STACK_TRANSITION = {
  lift: { duration: 0.24, ease: EASE.lift },
  away: { duration: 0.38, ease: EASE.drift },
  /** Landing: a small spring settle */
  settle: {
    default: { type: "spring", stiffness: 260, damping: 21, mass: 0.9 },
    boxShadow: { duration: 0.35, ease: "easeOut" },
    opacity: { duration: 0.2 },
  },
  /** Papers shifting depth while another one moves */
  shift: {
    default: { type: "spring", stiffness: 200, damping: 26 },
    opacity: { duration: 0.3 },
  },
  /** prefers-reduced-motion: simple crossfades */
  fade: { duration: 0.18, ease: "easeOut" },
  fadeIn: { duration: 0.22, ease: "easeOut" },
} satisfies Record<string, Transition>;

export const READER = {
  /** Paper grows from its spot in the stack into the centered reader */
  open: { duration: 0.55, ease: [0.22, 0.8, 0.2, 1] },
  close: { duration: 0.42, ease: [0.4, 0, 0.2, 1] },
  /** The cover fades to page one as the paper finishes growing */
  coverOut: { duration: 0.25, delay: 0.34, ease: "easeOut" },
  coverIn: { duration: 0.16, ease: "easeOut" },
  backdropOpacity: 0.82,
  backdrop: { duration: 0.3, ease: "easeOut" },
  controlsIn: { duration: 0.2, delay: 0.3 },
  controlsOut: { duration: 0.12 },
  /** prefers-reduced-motion: the reader fades in place */
  fade: { duration: 0.2, ease: "easeOut" },
} satisfies Record<string, Transition | number>;

export const PAGE_TURN = {
  duration: 0.45,
  ease: [0.4, 0, 0.2, 1],
  /** The outgoing page turns on its left edge by this much */
  angle: -15,
  perspective: 1600,
  /** Darkest point of the shadow that sweeps across the turning page */
  shadow: 0.3,
} as const;

export const SWIPE = {
  /** Minimum horizontal travel in px to count as a swipe */
  minDistance: 40,
  /** Horizontal travel must beat vertical by this ratio */
  dominance: 1.3,
} as const;
