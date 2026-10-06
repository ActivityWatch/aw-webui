import { fitLabel, sunburstLabelFontPx } from '~/util/sunburstLabels';

// 1px per character keeps the expected cut points readable.
const measure = (s: string) => s.length;

describe('fitLabel', () => {
  it('returns the label unchanged when it fits', () => {
    expect(fitLabel('Work', 4, measure)).toBe('Work');
  });

  it('keeps the start and ellipsizes the end when too long', () => {
    expect(fitLabel('ActivityWatch', 6, measure)).toBe('Activ…');
  });

  it('never returns something wider than the limit', () => {
    for (let w = 2; w < 13; w++) {
      const out = fitLabel('ActivityWatch', w, measure);
      expect(out).not.toBeNull();
      expect(measure(out as string)).toBeLessThanOrEqual(w);
    }
  });

  it('trims trailing whitespace before the ellipsis', () => {
    expect(fitLabel('Media Player', 7, measure)).toBe('Media…');
  });

  it('returns null when not even one character fits', () => {
    expect(fitLabel('Work', 1, measure)).toBeNull();
  });
});

describe('sunburstLabelFontPx', () => {
  it('mirrors the vue-d3-sunburst per-slice font sizes', () => {
    expect([1, 2, 3, 4, 5].map(sunburstLabelFontPx)).toEqual([11, 10, 9, 8, 8]);
  });
});
