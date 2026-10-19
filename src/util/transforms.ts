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

function eventBounds(event): { start: Date; end: Date; end_ms: number } {
  const start = new Date(event.timestamp);
  const end_ms = start.valueOf() + 1000 * event.duration;
  return { start, end: new Date(end_ms), end_ms };
}

export function overlappingEvents(events1, events2): Overlap[] {
  // Compared before sorting, since sorting a copy keeps the caller's lists untouched.
  const same_list = events1 === events2;

  const sorted1 = [...events1].sort(
    (a, b) => new Date(a.timestamp).valueOf() - new Date(b.timestamp).valueOf()
  );
  const sorted2 = same_list
    ? sorted1
    : [...events2].sort(
        (a, b) => new Date(a.timestamp).valueOf() - new Date(b.timestamp).valueOf()
      );

  let i = 0;
  let j = 0;
  const overlapping = [];
  while (i < sorted1.length && j < sorted2.length) {
    const e1 = sorted1[i];
    const e2 = sorted2[j];

    // If `events1` and `events2` are the same list, we need to check if we are comparing the same event
    if (same_list && e1 === e2) {
      i++;
      continue;
    }

    const e1_bounds = eventBounds(e1);
    const e2_bounds = eventBounds(e2);

    // Check for overlap. Two half-open intervals overlap when each starts
    // before the other ends; this is symmetric, so containment in either
    // direction and equal bounds are both detected. Merely touching
    // (one ends where the other starts) is not an overlap, and neither is a
    // zero-length event: it spans no time, so it must not block a merge.
    if (
      e1_bounds.start.valueOf() < e1_bounds.end_ms &&
      e2_bounds.start.valueOf() < e2_bounds.end_ms &&
      e1_bounds.start.valueOf() < e2_bounds.end_ms &&
      e2_bounds.start.valueOf() < e1_bounds.end_ms
    ) {
      const overlap1 = {
        start: e1_bounds.start,
        end: e1_bounds.end,
        event: e1,
      };
      const overlap2 = {
        start: e2_bounds.start,
        end: e2_bounds.end,
        event: e2,
      };
      overlapping.push([overlap1, overlap2]);
    }

    // Advance whichever interval ends first; the other may still overlap later ones.
    if (e2_bounds.end_ms > e1_bounds.end_ms) {
      i++;
    } else {
      j++;
    }
  }

  if (overlapping.length > 0) {
    console.warn('Overlapping events found', overlapping);
  }
  return overlapping;
}
