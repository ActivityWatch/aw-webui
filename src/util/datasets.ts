import _ from 'lodash';

import { split_by_hour_into_data } from '~/util/transforms';
import { getColorFromCategory } from '~/util/color';
import { Category } from '~/util/classes';
import { IEvent } from './interfaces';

interface HourlyData {
  cat_events: IEvent[];
}

interface Dataset {
  label: string;
  backgroundColor: string;
  data: (number | null)[];
}

export function buildBarchartDataset(data_by_hour: HourlyData[], classes: Category[]): Dataset[] {
  const data = data_by_hour;
  if (data) {
    const category_names: Set<string> = new Set(
      Object.values(data)
        .map(result => {
          return result.cat_events.map(e => JSON.stringify(e.data['$category'] || []));
        })
        .flat()
    );
    const ds: Dataset[] = [...category_names].map(c_ => {
      const path: string[] = JSON.parse(c_);
      const c = classes.find(category => _.isEqual(category.name, path));

      const values = Object.values(data).map(results => {
        const events = results.cat_events.filter(e => _.isEqual(e.data['$category'] || [], path));
        if (events.length)
          return Math.round((_.sumBy(events, 'duration') / (60 * 60)) * 1000) / 1000;
        else return null;
      });
      return {
        label: path.length ? path.join(' > ') : 'Uncategorized',
        backgroundColor: getColorFromCategory(c, classes),
        data: values,
      } as Dataset;
    });
    return ds;
  } else {
    return [];
  }
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
