import moment from 'moment';

interface CalendarEvent {
  start: string;
  end: string;
}

export function calendarTimeBounds(events: CalendarEvent[], fitToActive: boolean) {
  const fullDay = { slotMinTime: '00:00:00', slotMaxTime: '24:00:00' };
  if (!fitToActive || !events.length) return fullDay;

  let firstHour = 24;
  let lastHour = 0;
  for (const event of events) {
    const start = moment(event.start, moment.ISO_8601, true);
    const end = moment(event.end, moment.ISO_8601, true);
    if (!start.isValid() || !end.isValid() || !end.isAfter(start)) return fullDay;

    // Midnight is a valid exclusive upper bound. Events continuing into
    // another day need the full grid so neither daily segment is clipped.
    const nextMidnight = start.clone().startOf('day').add(1, 'day');
    if (end.isAfter(nextMidnight)) return fullDay;
    const endHour = end.isSame(nextMidnight)
      ? 24
      : end.hour() + (end.minute() || end.second() || end.millisecond() ? 1 : 0);
    firstHour = Math.min(firstHour, start.hour());
    lastHour = Math.max(lastHour, endHour, start.hour() + 1);
  }

  const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00:00`;
  return { slotMinTime: formatHour(firstHour), slotMaxTime: formatHour(lastHour) };
}
