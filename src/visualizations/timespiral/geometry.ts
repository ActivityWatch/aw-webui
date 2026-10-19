// Geometry of the timespiral: a logarithmic spiral with one turn per day.
//
// A point at time L (local days, see time.ts) with radial offset k (in turns,
// 0 = the centre line of that day's band) sits at
//
//   radius = R * q^(L - F + k)
//   angle  = 2π (L - rho) - π/2
//
// where F is the focused time (it sits at radius R) and rho the rotation.
// Because the spiral is logarithmic, changing F is a pure zoom and changing
// rho a pure rotation. So a day's shapes can be built once, in that day's own
// coordinates (see dayTransform), and redrawn every frame with a transform.

export const TAU = Math.PI * 2;
/** Half-width of a day's activity band, in turns (bands of adjacent days are 1 apart). */
export const BAND = 0.32;
/** Samples per day when tracing the spiral. */
export const STEPS = 360;

export interface View {
  cx: number;
  cy: number;
  /** Radius at the focused time. */
  R: number;
  /** Growth factor per turn. */
  q: number;
  /** Focused time (local days). */
  F: number;
  /** Rotation, in turns. rho = F - floor(F) keeps the focused time at the top. */
  rho: number;
}

export function radius(v: View, L: number, k = 0): number {
  return v.R * Math.pow(v.q, L - v.F + k);
}

export function angle(v: View, L: number): number {
  // Subtracting whole turns keeps the argument small (no effect on the result).
  return TAU * (L - Math.floor(v.F) - v.rho) - Math.PI / 2;
}

export function point(v: View, L: number, k = 0): [number, number] {
  const r = radius(v, L, k);
  const a = angle(v, L);
  return [v.cx + r * Math.cos(a), v.cy + r * Math.sin(a)];
}

/** Inverse of point(): the time and radial offset (within [-0.5, 0.5)) at a screen position. */
export function hitTest(v: View, x: number, y: number): { L: number; k: number } | null {
  const dx = x - v.cx;
  const dy = y - v.cy;
  const r = Math.hypot(dx, dy);
  if (r < 1) return null;
  const Fi = Math.floor(v.F);
  const base = (Math.atan2(dy, dx) + Math.PI / 2) / TAU + Fi + v.rho;
  const off = Math.log(r / v.R) / Math.log(v.q); // = L - F + k
  const L = base + Math.round(v.F + off - base);
  return { L, k: off - (L - v.F) };
}

/** Range of times that are visible: from sub-pixel turns in the centre to off-screen. */
export function visibleRange(v: View, width: number, height: number): { lo: number; hi: number } {
  const lnq = Math.log(v.q);
  const far = Math.hypot(Math.max(v.cx, width - v.cx), Math.max(v.cy, height - v.cy));
  return {
    lo: v.F - Math.log(v.R / 3) / lnq, // until the turns are a few px across
    hi: v.F + Math.log(far / v.R) / lnq + 0.5,
  };
}

/**
 * Canvas transform (a, b, c, d, e, f) that maps day-local coordinates of day d
 * (see dayBand) onto the screen.
 */
export function dayTransform(
  v: View,
  d: number,
  scale = 1
): [number, number, number, number, number, number] {
  const s = v.R * Math.pow(v.q, d - v.F) * scale;
  const t = -TAU * v.rho;
  const cos = Math.cos(t) * s;
  const sin = Math.sin(t) * s;
  return [cos, sin, -sin, cos, v.cx * scale, v.cy * scale];
}

/**
 * Outline of the band between times a and b (relative to the day, so in [0, 1]
 * for the day itself) and radial offsets k0 < k1, in day-local coordinates:
 * the spiral with R = 1 and F = the day's midnight, unrotated.
 * Returns a flat [x0, y0, x1, y1, ...] polygon.
 */
export function dayBand(q: number, a: number, b: number, k0: number, k1: number): number[] {
  const n = Math.max(1, Math.ceil((b - a) * STEPS));
  const lnq = Math.log(q);
  const pts: number[] = [];
  const push = (L: number, k: number) => {
    const r = Math.exp((L + k) * lnq);
    const t = TAU * L - Math.PI / 2;
    pts.push(r * Math.cos(t), r * Math.sin(t));
  };
  for (let i = 0; i <= n; i++) push(a + ((b - a) * i) / n, k1);
  for (let i = n; i >= 0; i--) push(a + ((b - a) * i) / n, k0);
  return pts;
}

/** Same as dayBand, but in screen coordinates (for one-off shapes like outlines). */
export function screenBand(v: View, a: number, b: number, k0: number, k1: number): number[] {
  const n = Math.max(1, Math.ceil((b - a) * STEPS));
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) pts.push(...point(v, a + ((b - a) * i) / n, k1));
  for (let i = n; i >= 0; i--) pts.push(...point(v, a + ((b - a) * i) / n, k0));
  return pts;
}
