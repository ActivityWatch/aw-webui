import { clampStackedHours } from '~/util/timelineClamp';

describe('clampStackedHours', () => {
  it('trims overlapping datasets so each stack is at most 1h', () => {
    const out = clampStackedHours([
      { label: 'a', data: [0.5, 1, 0.2] },
      { label: 'b', data: [0.8, 0.5, 0.2] },
    ]);
    expect(out[0].data).toEqual([0.5, 1, 0.2]);
    expect(out[1].data[0]).toBeCloseTo(0.5);
    expect(out[1].data[1]).toBe(0);
    expect(out[1].data[2]).toBeCloseTo(0.2);
  });

  it('does not mutate the input and keeps other dataset fields', () => {
    const input = [{ label: 'a', backgroundColor: '#fff', data: [2] }];
    const out = clampStackedHours(input);
    expect(input[0].data).toEqual([2]);
    expect(out[0].backgroundColor).toBe('#fff');
    expect(out[0].data).toEqual([1]);
  });
});
