// Overlapping events from different buckets can sum to more than one hour in a
// single hourly bar. Scale an overfull stack down proportionally so it fits in
// one hour: the y-axis can be capped without clipped segments (which lose their
// tooltips), and no category is dropped just because of its sort order.
export function clampStackedHours(datasets: any[]): any[] {
  const totals: number[] = [];
  for (const d of datasets) {
    (d.data || []).forEach((v: number, i: number) => {
      totals[i] = (totals[i] || 0) + Math.max(0, v || 0);
    });
  }
  return datasets.map(d => ({
    ...d,
    data: (d.data || []).map((v: number, i: number) => {
      const value = Math.max(0, v || 0);
      return totals[i] > 1 ? value / totals[i] : value;
    }),
  }));
}
