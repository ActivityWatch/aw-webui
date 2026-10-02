import { clampStackedHours } from '~/util/timelineClamp';

describe('clampStackedHours', () => {
  it('scales overfull stacks down proportionally to 1h', () => {
    const out = clampStackedHours([
      { label: 'a', data: [0.5, 1, 0.2] },
      { label: 'b', data: [1.5, 0.5, 0.2] },
    ]);
    // Hour 0: 0.5 + 1.5 = 2h -> halved
    expect(out[0].data[0]).toBeCloseTo(0.25);
    expect(out[1].data[0]).toBeCloseTo(0.75);
    // Hour 1: 1 + 0.5 = 1.5h -> both kept in 2:1 ratio, nothing dropped
    expect(out[0].data[1]).toBeCloseTo(2 / 3);
    expect(out[1].data[1]).toBeCloseTo(1 / 3);
    // Hour 2: fits in 1h -> untouched
    expect(out[0].data[2]).toBe(0.2);
    expect(out[1].data[2]).toBe(0.2);
  });

  it('does not depend on dataset order', () => {
    const a = { label: 'a', data: [1] };
    const b = { label: 'b', data: [0.5] };
    const ab = clampStackedHours([a, b]);
    const ba = clampStackedHours([b, a]);
    expect(ab[0].data[0]).toBeCloseTo(ba[1].data[0]);
    expect(ab[1].data[0]).toBeCloseTo(ba[0].data[0]);
    expect(ab[1].data[0]).toBeGreaterThan(0);
  });

  it('does not mutate the input and keeps other dataset fields', () => {
    const input = [{ label: 'a', backgroundColor: '#fff', data: [2] }];
    const out = clampStackedHours(input);
    expect(input[0].data).toEqual([2]);
    expect(out[0].backgroundColor).toBe('#fff');
    expect(out[0].data).toEqual([1]);
  });
});
