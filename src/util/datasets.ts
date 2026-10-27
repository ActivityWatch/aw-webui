import _ from 'lodash';
import moment from 'moment';

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

const ISO_WEEKDAY: Record<string, number> = { Monday: 1, Saturday: 6, Sunday: 7 };

/**
 * Groups per-day barchart entries (keyed by "start/end" period strings, in
 * chronological order) into weeks beginning on `startOfWeek`.
 *
 * Returns the week-start date of the first bucket and one entry per week,
 * oldest first. Edge weeks only contain the days inside the queried range.
 */
export function groupDaysIntoWeeks(
  byDay: Record<string, HourlyData>,
  startOfWeek: string
): { firstWeekStart: string | null; byWeek: Record<string, HourlyData> } {
  const weekStartIso = ISO_WEEKDAY[startOfWeek] || 1;
  const byWeek: Record<string, HourlyData> = {};
  for (const [period, entry] of Object.entries(byDay)) {
    // Read the calendar date as written, ignoring the timezone offset, so a
    // day's bucket never moves to its neighbour.
    const day = moment.parseZone(period.split('/')[0]);
    const back = (day.isoWeekday() - weekStartIso + 7) % 7;
    const key = day.clone().subtract(back, 'days').format('YYYY-MM-DD');
    if (!byWeek[key]) byWeek[key] = { cat_events: [] };
    byWeek[key].cat_events = byWeek[key].cat_events.concat(entry?.cat_events || []);
  }
  const keys = Object.keys(byWeek);
  return { firstWeekStart: keys.length ? keys[0] : null, byWeek };
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
