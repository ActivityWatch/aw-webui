import moment from 'moment';
import { get_day_start_with_offset } from '~/util/time';

export interface TimePeriod {
  start: string;
  length: [number, string];
}

export function dateToTimeperiod(date: string, duration?: [number, string]): TimePeriod {
  return { start: get_day_start_with_offset(date), length: duration || [1, 'day'] };
}

export function timeperiodToStr(tp: TimePeriod): string {
  const start = moment(tp.start).format();
  const end = moment(start)
    .add(tp.length[0], tp.length[1] as moment.unitOfTime.DurationConstructor)
    .format();
  return [start, end].join('/');
}

export function dateformat(periodLength: string) {
  if (periodLength === 'day') {
    return 'YYYY-MM-DD';
  } else if (periodLength === 'week') {
    return 'YYYY[ W]WW';
  } else if (periodLength === 'month') {
    return 'YYYY-MM';
  } else if (periodLength === 'year') {
    return 'YYYY';
  } else {
    return 'YYYY-MM-DD';
  }
}

export function periodReadable(timeperiod: TimePeriod) {
  return moment(timeperiod.start).format(dateformat(timeperiod.length[1]));
}

export function periodLengthConvertMoment(periodLength: string) {
  if (periodLength === 'day') {
    return 'day';
  } else if (periodLength === 'week') {
    /* This is necessary so the week starts on Monday instead of Sunday */
    return 'isoWeek';
  } else if (periodLength === 'month') {
    return 'month';
  } else if (periodLength === 'year') {
    return 'year';
  } else {
    console.error('Invalid periodLength ${periodLength}, defaulting to "day"');
    return 'day';
  }
}

export function timeperiodsAroundTimeperiod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  for (let i = -15; i <= 15; i++) {
    const start = moment(timeperiod.start)
      .add(i * timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ ...timeperiod, start });
  }
  return periods;
}

export function timeperiodsHoursOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  const _length: [number, string] = [1, 'hour'];
  for (let i = 0; i < 24; i++) {
    const start = moment(timeperiod.start)
      .add(i * _length[0], _length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ start, length: _length });
  }
  // const periods = _.range(24).map(i => [TimePeriod(moment(i * 1 + dayOffset), [1, 'hour'])]);
  return periods;
}

export function timeperiodsDaysOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  const _length: [number, string] = [1, 'day'];

  let count: number;
  if (timeperiod.length[1] == 'week') {
    count = 7;
  } else if (timeperiod.length[1] == 'month') {
    count = moment(timeperiod.start).daysInMonth();
  }

  for (let i = 0; i < count; i++) {
    const start = moment(timeperiod.start)
      .add(i * _length[0], _length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ start, length: _length });
  }
  // const periods = _.range(24).map(i => [TimePeriod(moment(i * 1 + dayOffset), [1, 'hour'])]);
  return periods;
}
