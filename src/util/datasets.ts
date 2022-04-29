import _ from 'lodash';

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

export function buildBarchartDataset(data_by_hour: HourlyData[], classes: Category[]): Dataset[] {
  const SEP = '>>>';
  const data = data_by_hour;
  if (data) {
    const category_names: Set<string> = new Set(
      Object.values(data)
        .map(result => {
          return result.cat_events.map(e => e.data['$category'].join(SEP));
        })
        .flat()
    );
    const ds: Dataset[] = [...category_names]
      .map(c_ => {
        const categoryStore = useCategoryStore();
        const c = categoryStore.get_category(c_.split(SEP));

        if (c) {
          const values = Object.values(data).map(results => {
            const cat = results.cat_events.find(e => _.isEqual(e.data['$category'], c.name));
            if (cat) return Math.round((cat.duration / (60 * 60)) * 1000) / 1000;
            else return null;
          });
          return {
            label: c.name.join(' > '),
            backgroundColor: getColorFromCategory(c, classes),
            data: values,
          } as Dataset;
        } else {
          // FIXME: This shouldn't happen
          // This may for example happen if one doesn't have an 'Uncategorized' category,
          // as can happen when one upgrades from an old version where there wasn't one in the default classes.
          console.error('missing category:', c_);
        }
      })
      .filter(x => x);
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
