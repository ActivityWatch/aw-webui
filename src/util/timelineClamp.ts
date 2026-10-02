// Overlapping events from different buckets can sum to more than one hour in a
// single hourly bar. Trim the stack to one hour so the y-axis can be capped
// without clipped segments (which lose their tooltips).
export function clampStackedHours(datasets: any[]): any[] {
  const used: number[] = [];
  return datasets.map(d => ({
    ...d,
    data: (d.data || []).map((v: number, i: number) => {
      const remaining = Math.max(0, 1 - (used[i] || 0));
      const clamped = Math.min(v || 0, remaining);
      used[i] = (used[i] || 0) + clamped;
      return clamped;
    }),
  }));
}
