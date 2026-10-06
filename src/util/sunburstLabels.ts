// Label fitting for the category sunburst (vue-d3-sunburst).
//
// The library clips each ring's labels to the ring plus `maxLabelText` px and,
// for labels on the left half, shifts an over-long label by its measured
// overflow. When that measurement is missed the label keeps its outer end and
// loses its start ("ivityWatch"); when it works the end is cut at the inner
// edge instead. Fitting the text to the available space up front means no
// label ever needs shifting or clipping.

const ELLIPSIS = '…';

// Mirrors `svg .slice-N text.node-info { font-size }` in vue-d3-sunburst.css.
export function sunburstLabelFontPx(relativeDepth: number): number {
  return { 1: 11, 2: 10, 3: 9 }[relativeDepth] ?? 8;
}

// Returns `text` if it fits in `maxWidth`, else the longest prefix plus an
// ellipsis that fits, or null when not even one character fits.
export function fitLabel(
  text: string,
  maxWidth: number,
  measure: (s: string) => number
): string | null {
  if (measure(text) <= maxWidth) return text;
  const truncated = (n: number) => text.slice(0, n).trimEnd() + ELLIPSIS;
  let lo = 0;
  let hi = text.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(truncated(mid)) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? truncated(lo) : null;
}

let canvasCtx: CanvasRenderingContext2D | null | undefined;

// Text width in px; falls back to an average glyph width where canvas is
// unavailable (e.g. jsdom).
export function measureText(text: string, fontPx: number, fontFamily: string): number {
  if (canvasCtx === undefined) {
    try {
      canvasCtx = document.createElement('canvas').getContext('2d');
    } catch (e) {
      canvasCtx = null;
    }
  }
  if (!canvasCtx) return text.length * fontPx * 0.6;
  canvasCtx.font = `${fontPx}px ${fontFamily}`;
  return canvasCtx.measureText(text).width;
}
