export type TimelineTimeFormat = '24h' | '12h';

/** Moment format for a time of day with seconds, as shown in timeline tooltips. */
export function timelineClockFormat(timeFormat: TimelineTimeFormat): string {
  return timeFormat === '12h' ? 'h:mm:ss A' : 'HH:mm:ss';
}

/**
 * vis-timeline options for the clock format of its time axis.
 *
 * The 24-hour labels repeat vis-timeline's defaults because `setOptions` merges
 * `format` into the previous value, so omitting them could not switch back.
 */
export function timelineAxisOptions(timeFormat: TimelineTimeFormat) {
  const twelveHour = timeFormat === '12h';
  const clock = twelveHour ? 'h:mm A' : 'HH:mm';
  return {
    format: {
      minorLabels: { minute: clock, hour: clock },
      majorLabels: {
        millisecond: timelineClockFormat(timeFormat),
        second: `D MMMM ${clock}`,
      },
    },
    // Reserve room for the longest label, so that "12:00 PM" labels don't overlap.
    // The axis is always English: vis-timeline formats it with its own bundled moment.
    maxMinorChars: twelveHour ? 8 : 7,
  };
}
