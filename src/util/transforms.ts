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

type EventBounds = {
  start: Date;
  end: Date;
  start_ms: number;
  end_ms: number;
  event: object;
};

function eventBounds(event): EventBounds {
  const start = new Date(event.timestamp);
  const start_ms = start.valueOf();
  const end_ms = start_ms + 1000 * event.duration;
  return { start, end: new Date(end_ms), start_ms, end_ms, event };
}

function toOverlapPart(bounds: EventBounds): OverlapPart {
  return { start: bounds.start, end: bounds.end, event: bounds.event };
}

function intersects(a: EventBounds, b: EventBounds): boolean {
  // Half-open intervals overlap when each starts before the other ends. This is
  // symmetric, so containment in either direction and equal bounds are both
  // detected; merely touching endpoints is not an overlap, and a zero-length
  // event spans no time, so it must not block a merge.
  return (
    a.start_ms < a.end_ms && b.start_ms < b.end_ms && a.start_ms < b.end_ms && b.start_ms < a.end_ms
  );
}

function dropEnded(active: EventBounds[], now_ms: number) {
  // Everything still active started at or before `now_ms`; one that ended by
  // then can never overlap a later event, so it is safe to forget.
  let kept = 0;
  for (const bounds of active) {
    if (bounds.end_ms > now_ms) {
      active[kept++] = bounds;
    }
  }
  active.length = kept;
}

export function overlappingEvents(events1, events2): Overlap[] {
  // Compared before sorting, since sorting a copy keeps the caller's lists untouched.
  const same_list = events1 === events2;

  const sorted1 = events1.map(eventBounds).sort((a, b) => a.start_ms - b.start_ms);

  // Every pair is compared exactly once, so internally overlapping input lists
  // are enumerated exactly instead of only as far as a one-pointer-per-step
  // sweep happens to reach.
  const overlapping: Overlap[] = [];
  const active1: EventBounds[] = [];

  if (same_list) {
    // Compare each event only against the still-open events before it, which
    // yields each unordered pair once and never an event against itself.
    for (const current of sorted1) {
      dropEnded(active1, current.start_ms);
      for (const other of active1) {
        if (intersects(other, current)) {
          overlapping.push([toOverlapPart(other), toOverlapPart(current)]);
        }
      }
      active1.push(current);
    }
  } else {
    const sorted2 = events2.map(eventBounds).sort((a, b) => a.start_ms - b.start_ms);
    const active2: EventBounds[] = [];
    let i = 0;
    let j = 0;

    // Sweep both lists in start order, keeping the still-open intervals of each
    // list so every cross pair is visited.
    while (i < sorted1.length || j < sorted2.length) {
      // Ties go to the first list so the second list's event sees it as active.
      const take_first =
        j >= sorted2.length || (i < sorted1.length && sorted1[i].start_ms <= sorted2[j].start_ms);
      const current = take_first ? sorted1[i++] : sorted2[j++];

      // Only the list being compared against needs expiring. An event that has
      // already ended cannot overlap a later one, and expiring the current
      // event's own list would rescan every live event without ever producing a
      // pair (quadratic when one bucket is internally overlapping and the other
      // is empty). The own list is expired when the sweep reaches the point
      // where it is the one being scanned.
      const others = take_first ? active2 : active1;
      dropEnded(others, current.start_ms);

      for (const other of others) {
        if (intersects(current, other)) {
          overlapping.push(
            take_first
              ? [toOverlapPart(current), toOverlapPart(other)]
              : [toOverlapPart(other), toOverlapPart(current)]
          );
        }
      }
      (take_first ? active1 : active2).push(current);
    }
  }

  if (overlapping.length > 0) {
    console.warn('Overlapping events found', overlapping);
  }
  return overlapping;
}
