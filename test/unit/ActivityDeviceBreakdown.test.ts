import ActivityComponent from '~/views/activity/Activity.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Activity: any = ActivityComponent;

describe('Activity per-device breakdown bar', () => {
  const hostDurations = [
    { host: 'desktop', duration: 3600, overlap: 0 },
    { host: 'laptop', duration: 1800, overlap: 600 },
    { host: 'phone', duration: 1200, overlap: 0 },
    { host: 'tablet', duration: 600, overlap: 0 },
  ];

  test('segment widths are each device share of the merged total', () => {
    const vm = { hostDurations };
    const shares = hostDurations.map(d => Activity.methods.deviceShare.call(vm, d));
    expect(shares).toEqual([50, 25, 100 / 6, 100 / 12]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  test('an empty total gives zero-width segments instead of NaN', () => {
    const vm = { hostDurations: [{ host: 'a', duration: 0, overlap: 0 }] };
    expect(Activity.methods.deviceShare.call(vm, vm.hostDurations[0])).toBe(0);
  });
});
