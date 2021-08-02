import _ from 'lodash';

import { split_by_hour_into_data } from '~/util/transforms';
import { getColorFromCategory } from '~/util/color';
import { Category } from '~/util/classes';

// TODO: Move elsewhere
interface Event {
  timestamp: string;
  duration: number;
  data: object;
}

interface HourlyData {
  cat_events: Event[];
}

interface Dataset {
  label: string;
  backgroundColor: string | undefined;
  borderColor: string | undefined;
  data: number[];
  stack: string | undefined;
  type: string | undefined;
}

interface HeatmapDataset {
  name: string;
  data: number[];
}

function getColorWithOpacity(color: string, opacity: string): string {
  let newColor = color.split('');
  if (newColor[0] === '#') {
    newColor = newColor.slice(1);
  }

  if (newColor.length === 3) {
    newColor = Array.from({ length: 6 }, (e, i) => newColor[i % 3]);
  }

  newColor.push(opacity);

  return '#' + newColor.join('');
}

export function buildBarchartDataset(
  $store: any,
  data_by_hour: HourlyData[],
  classes: Category[]
): Dataset[] {
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
        const c = $store.getters['categories/get_category'](c_.split(SEP));
        if (c) {
          const values = Object.values(data).map(results => {
            const cat = results.cat_events.find(e => _.isEqual(e.data['$category'], c.name));
            if (cat) return Math.round((cat.duration / (60 * 60)) * 1000) / 1000;
            else return null;
          });
          return {
            label: c.name.join(' > '),
            backgroundColor: getColorWithOpacity(getColorFromCategory(c, classes), '46'),
            data: values,
            stack: 'combined'
          } as Dataset;
        } else {
          // FIXME: This shouldn't happen
          // This may for example happen if one doesn't have an 'Uncategorized' category,
          // as can happen when one upgrades from an old version where there wasn't one in the default classes.
          console.error('missing category:', c_);
        }
      })
      .filter(x => x);

    ds.push({
      label: 'Max',
      data: Object.values(data).map((d, i) => ds.reduce((cur, d) => cur + d.data[i] || 0, 0)),
      borderColor: '#0000FF',
      backgroundColor: undefined,
      stack: 'combined',
      type: 'line',
    });

    return ds;
  } else {
    return [];
  }
}

export function buildHeatmapDataset(
  $store: any,
  data_by_period: HourlyData[]
): HeatmapDataset[] {
  const SEP = '>>>';
  const data = data_by_period;
  if (data) {
    const category_names: Set<string> = new Set(
      Object.values(data)
        .map(result => {
          return result.cat_events.map(e => e.data['$category'].join(SEP));
        })
        .flat()
    );
    const ds: HeatmapDataset[] = [...category_names]
      .map(c_ => {
        const c = $store.getters['categories/get_category'](c_.split(SEP));
        if (c) {
          const values = Object.values(data).map(results => {
            const cat = results.cat_events.find(e => _.isEqual(e.data['$category'], c.name));
            if (cat) return Math.round((cat.duration / (60 * 60)) * 1000) / 1000;
            else return null;
          });
          return {
            name: c.name.join(' > '),
            data: values,
          } as HeatmapDataset;
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

export function buildBarchartDatasetActive($store: any, events_active: Event[]) {
  const data = split_by_hour_into_data(events_active);
  return [
    {
      label: 'Total time',
      backgroundColor: '#6699ff',
      data,
    },
  ];
}
