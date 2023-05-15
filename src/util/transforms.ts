import _ from 'lodash';
import moment from 'moment';
import { get_hour_offset } from '~/util/time';

// TODO: Move somewhere else, possibly turn into a serverside transform
export function split_by_hour_into_data(events) {
  if (events === undefined || events === null || events.length == 0) return [];
  const d = moment(events[0].timestamp).startOf('day');
  const hoursOffset = get_hour_offset();
  return _.range(0, 24).map(h => {
    h += hoursOffset;
    let duration = 0;
    const d_start = d.clone().hour(h);
    const d_end = d.clone().hour(h + 1);
    // This can be made faster by not checking every event per hour, but since number of events is small anyway this and this is a lot shorter and easier to read it doesn't really matter.
    events.map(e => {
      const e_start = moment(e.timestamp);
      const e_end = e_start.clone().add(e.duration, 'seconds');
      if (
        e_start.isBetween(d_start, d_end) ||
        e_end.isBetween(d_start, d_end) ||
        d_start.isBetween(e_start, e_end)
      ) {
        if (d_start < e_start && e_end < d_end) {
          // If entire event is contained within the hour
          duration += e.duration;
        } else if (d_start < e_start) {
          // If start of event is within the hour, but not the end
          duration += (d_end.valueOf() - e_start.valueOf()) / 1000;
        } else if (e_end < d_end) {
          // If end of event is within the hour, but not the start
          duration += (e_end.valueOf() - d_start.valueOf()) / 1000;
        } else {
          // Happens if event covers entire hour and more
          duration += 3600;
        }
      }
    });
    return duration / 60 / 60;
  });
}

type OverlapPart = {
  start: Date;
  end: Date;
  event: object;
};
type Overlap = [OverlapPart, OverlapPart];

export function overlappingEvents(events1, events2): Overlap[] {
  events1 = events1.sort((a, b) => a.timestamp - b.timestamp);
  events2 = events2.sort((a, b) => a.timestamp - b.timestamp);

  let i = 0;
  let j = 0;
  const overlapping = [];
  while (i < events1.length && j < events2.length) {
    const e1 = events1[i];
    const e2 = events2[j];

    // If `events1` and `events2` are the same list, we need to check if we are comparing the same event
    if (events1 === events2 && e1 === e2) {
      i++;
      continue;
    }

    const e1_start = new Date(e1.timestamp);
    const e2_start = new Date(e2.timestamp);
    const e1_end = new Date(new Date(e1.timestamp).valueOf() + 1000 * e1.duration);
    const e2_end = new Date(new Date(e2.timestamp).valueOf() + 1000 * e2.duration);

    // Check for overlap
    if (
      // `e2.start` is within `e1`
      (e1_start < e2_start && e2_start < e1_end) ||
      // `e2.end` is within `e1`
      (e1_start < e2_end && e2_end <= e1_end)
    ) {
      const overlap1 = {
        start: e1_start,
        end: e1_end,
        event: e1,
      };
      const overlap2 = {
        start: e2_start,
        end: e2_end,
        event: e2,
      };
      overlapping.push([overlap1, overlap2]);
    }

    // If `e2` ends after `e1`, advance `i`
    if (e2.timestamp + 1000 * e2.duration > e1.timestamp + 1000 * e1.duration) {
      i++;
    } else {
      // Otherwise, advance `j`
      j++;
    }
  }

  if (overlapping.length > 0) {
    console.warn('Overlapping events found', overlapping);
  }
  return overlapping;
}
