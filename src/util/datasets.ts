import { split_by_hour_into_data } from '~/util/transforms';
import { getColorFromCategory } from '~/util/color';
import { Category } from '~/util/classes';
import { IEvent } from './interfaces';
import { useCategoryStore } from '~/stores/categories';

interface HourlyData {
  cat_events: IEvent[];
}

interface Dataset {
  label: string;
  backgroundColor: string;
  data: number[];
}

export function buildBarchartDataset(
  data_by_hour: HourlyData[] | Record<string, HourlyData>,
  classes: Category[]
): Dataset[] {
  if (!data_by_hour) return [];
  const periods = Object.values(data_by_hour);
  const categoryPaths = new Map<string, string[]>();
  const totals = periods.map(period => {
    const sums = new Map<string, number>();
    for (const event of period.cat_events) {
      const path = event.data.$category || [];
      const key = JSON.stringify(path);
      if (!categoryPaths.has(key)) categoryPaths.set(key, path);
      sums.set(key, (sums.get(key) || 0) + event.duration);
    }
    return sums;
  });
  const categories = new Map<string, Category>();
  for (const category of classes) {
    const key = JSON.stringify(category.name);
    if (!categories.has(key)) categories.set(key, category);
  }
  return Array.from(categoryPaths, ([key, path]) => ({
    label: path.length ? path.join(' > ') : 'Uncategorized',
    backgroundColor: getColorFromCategory(categories.get(key), classes),
    data: totals.map(sums =>
      sums.has(key) ? Math.round((sums.get(key) / 3600) * 1000) / 1000 : null
    ),
  }));
}

export function buildBarchartDatasetActive(events_active: IEvent[]) {
  const data = split_by_hour_into_data(events_active);
  return [
    {
      label: 'Total time',
      backgroundColor: '#6699ff',
      data,
    },
  ];
}
