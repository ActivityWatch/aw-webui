import moment, { Moment, Duration } from 'moment';
import { useSettingsStore } from '~/stores/settings';

function getStartOfDayOffset() {
  const settingsStore = useSettingsStore();
  return settingsStore.startOfDay;
}

export function seconds_to_duration(seconds: number) {
  // Returns a human-readable duration string
  const hrs = Math.floor(seconds / 60 / 60);
  const min = Math.floor((seconds / 60) % 60);
  const sec = Math.floor(seconds % 60);
  const l = [];
  if (hrs != 0) l.push(hrs + 'h');
  if (min != 0) l.push(min + 'm');
  if (sec != 0 || l.length == 0) l.push(sec + 's');
  return l.join(' ');
}

export function friendlydate(timestamp: string | Moment) {
  const now = moment();
  const m = moment.parseZone(timestamp);
  const sinceNow = moment.duration(m.diff(now));
  if (-sinceNow.asSeconds() <= 60) {
    return `${Math.round(-sinceNow.asSeconds())}s ago`;
  } else if (-sinceNow.asSeconds() <= 60 * 60 * 24) {
    return sinceNow.humanize(true);
  }
  return sinceNow.humanize(true);
}

export function get_day_start_with_offset(dateParam: Moment | string, offset?: string) {
  if (!offset) {
    offset = getStartOfDayOffset();
  }
  const dateMoment = dateParam ? moment(dateParam) : moment().startOf('day');
  const start_of_day_hours = parseInt(offset.split(':')[0]);
  const start_of_day_minutes = parseInt(offset.split(':')[1]);
  return dateMoment.hour(start_of_day_hours).minute(start_of_day_minutes).format();
}

// Return the startOfDay offset as a number of hours
export function get_hour_offset(offset?: string): number {
  if (!offset) {
    offset = getStartOfDayOffset();
  }
  const start_of_day_hours = parseInt(offset.split(':')[0]);
  const start_of_day_minutes = parseInt(offset.split(':')[1]);
  return start_of_day_hours + start_of_day_minutes / 60;
}

export function get_day_end_with_offset(date: Moment | string, offset?: string): string {
  if (!offset) {
    offset = getStartOfDayOffset();
  }
  return moment(get_day_start_with_offset(date, offset)).add(1, 'days').format();
}

export function get_day_period(date: Moment | string, offset?: string): string {
  if (!offset) {
    offset = getStartOfDayOffset();
  }
  return get_day_start_with_offset(date, offset) + '/' + get_day_end_with_offset(date, offset);
}

export function get_prev_day(datestr: string): Moment {
  return moment(datestr).add(-1, 'days');
}

export function get_next_day(datestr: string): Moment {
  return moment(datestr).add(1, 'days');
}

export function get_offset_duration(offset?: string): Duration {
  if (!offset) {
    offset = getStartOfDayOffset();
  }
  const [hours, minutes] = offset.split(':');
  return moment.duration({ hours: Number(hours), minutes: Number(minutes) });
}

export function get_today_with_offset(offset?: string): string {
  if (!offset) {
    offset = getStartOfDayOffset();
  }
  // Gets "today" in an offset-aware way
  const offset_dur = get_offset_duration(offset);
  return moment().subtract(offset_dur).startOf('day').format('YYYY-MM-DD');
}
