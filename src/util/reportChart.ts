import moment from 'moment';
import { Category } from './classes';
import { getColorFromCategory } from './color';
import { IEvent } from './interfaces';
import { TimePeriod, timeperiodsForBarchart } from './timeperiod';

/** Bucket the returned report events using the same intervals as its chart labels. */
export function reportChartDatasets(events: IEvent[], period: TimePeriod, classes: Category[]) {
  const buckets = timeperiodsForBarchart(period).map(bucket => {
    const start = moment(bucket.start);
    const end = start
      .clone()
      .add(bucket.length[0], bucket.length[1] as moment.unitOfTime.DurationConstructor);
    return [start.valueOf(), end.valueOf()];
  });
  const datasets = new Map<string, { label: string; backgroundColor: string; data: number[] }>();
  for (const event of events) {
    const path: string[] = event.data.$category || [];
    const key = JSON.stringify(path);
    if (!datasets.has(key)) {
      datasets.set(key, {
        label: path.length ? path.join(' > ') : 'Uncategorized',
        backgroundColor: getColorFromCategory(
          classes.find(c => JSON.stringify(c.name) === key),
          classes
        ),
        data: buckets.map(() => 0),
      });
    }
    const start = moment(event.timestamp).valueOf();
    const end = start + event.duration * 1000;
    buckets.forEach(([bucketStart, bucketEnd], i) => {
      const overlap = Math.max(0, Math.min(end, bucketEnd) - Math.max(start, bucketStart));
      datasets.get(key).data[i] += overlap / 3600000;
    });
  }
  return [...datasets.values()];
}
