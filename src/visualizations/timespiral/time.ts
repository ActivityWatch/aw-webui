// "Local days": a continuous time axis where integer values are local midnights
// and the fractional part is the local time of day. The timespiral is laid out
// on it, one turn per local day, so the angle is the fractional part.
//
// DST days are 23h/25h long, so the axis skips/repeats an hour on those days.

const DAY_MS = 86_400_000;

export function ms2L(ms: number): number {
  return (ms - new Date(ms).getTimezoneOffset() * 60_000) / DAY_MS;
}

export function L2ms(L: number): number {
  const guess = L * DAY_MS;
  // Iterate once so the offset is the one in effect at the result, not the guess.
  let ms = guess + new Date(guess).getTimezoneOffset() * 60_000;
  ms = guess + new Date(ms).getTimezoneOffset() * 60_000;
  return ms;
}

export const nowL = (): number => ms2L(Date.now());

/** Duration in days to e.g. "3h 05m" or "42m". */
export function fmtDur(days: number): string {
  const m = Math.round(days * 1440);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** The activity day (as an integer, see dayStartL) that L falls in. */
export function activityDay(L: number, offset: number): number {
  return Math.floor(L - offset);
}

/** Start of activity day d, where offset is the start-of-day setting in days (04:00 = 1/6). */
export function dayStartL(d: number, offset: number): number {
  return d + offset;
}
