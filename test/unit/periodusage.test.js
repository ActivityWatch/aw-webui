import periodusage from '~/visualizations/periodusage';

jest.mock('~/util/time.ts', () => ({
  seconds_to_duration: seconds => `${seconds}s`,
  get_hour_offset: () => 0,
}));

describe('periodusage hover colors', () => {
  function bars() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const usage = [0, 1, 2].map(day => [
      { timestamp: `2026-01-0${day + 1}T12:00:00Z`, duration: 60, data: { status: 'not-afk' } },
    ]);
    periodusage.update(svg, usage, jest.fn());
    return [...svg.querySelectorAll('rect')];
  }

  test('restores ordinary and selected bar colors after hover', () => {
    bars().forEach(bar => {
      const color = bar.getAttribute('color');
      bar.dispatchEvent(new MouseEvent('mouseover'));
      expect(bar.style.fill).toBe('#adf');
      bar.dispatchEvent(new MouseEvent('mouseout'));
      expect(bar.style.fill).toBe(color);
    });
  });

  test('falls back to the original color when the attribute is absent', () => {
    bars().forEach(bar => {
      const color = bar.getAttribute('color');
      bar.removeAttribute('color');
      bar.dispatchEvent(new MouseEvent('mouseover'));
      bar.dispatchEvent(new MouseEvent('mouseout'));
      expect(bar.style.fill).toBe(color);
    });
  });
});
