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
          duration += (d_end - e_start) / 1000;
        } else if (e_end < d_end) {
          // If end of event is within the hour, but not the start
          duration += (e_end - d_start) / 1000;
        } else {
          // Happens if event covers entire hour and more
          duration += 3600;
        }
      }
    });
    return duration / 60 / 60;
  });
}
