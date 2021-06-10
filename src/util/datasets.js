import _ from 'lodash';

import { split_by_hour_into_data } from '~/util/transforms';
import { getColorFromCategory } from '~/util/color';

export function buildBarchartDataset($store, data_by_hour, events_active, classes) {
  const METHOD_CATEGORY = 'category';
  const METHOD_ACTIVITY = 'activity';
  const method = METHOD_CATEGORY;
  if (method == METHOD_CATEGORY) {
    const SEP = '>>>';
    const data = data_by_hour;
    if (data) {
      const categories = new Set(
        Object.values(data)
          .map(result => {
            return result.cat_events.map(e => e.data['$category'].join(SEP));
          })
          .flat()
      );
      const ds = [...categories].map(c_ => {
        const c = $store.getters['categories/get_category'](c_.split(SEP));
        if (c) {
          return {
            label: c.name.join(' > '),
            backgroundColor: getColorFromCategory(c, classes),
            data: Object.values(data).map(results => {
              const cat = results.cat_events.find(e => _.isEqual(e.data['$category'], c.name));
              if (cat) return Math.round((cat.duration / (60 * 60)) * 1000) / 1000;
              else return null;
            }),
          };
        } else {
          console.log('missing c');
        }
      });
      return ds;
    } else {
      return [];
    }
  } else if (method == METHOD_ACTIVITY) {
    const data = split_by_hour_into_data(events_active);
    return [
      {
        label: 'Total time',
        backgroundColor: '#6699ff',
        data,
      },
    ];
  }
  return [];
}
