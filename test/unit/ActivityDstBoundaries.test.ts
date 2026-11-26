import { execFileSync } from 'child_process';
import path from 'path';
import moment from 'moment';
import ActivityComponent from '~/views/activity/Activity.vue';
import SelectableVisualization from '~/components/SelectableVisualization.vue';
import TimelineBarChart from '~/visualizations/TimelineBarChart.vue';
import { dateToTimeperiod, timeperiodsHoursOfPeriod } from '~/util/timeperiod';

jest.mock('vue-chartjs/legacy', () => ({ Bar: { render: h => h('div') } }));
jest.mock('chart.js/auto', () => ({}));

if (!process.env.AW_UI_DST_ZONE) {
  test.each(['Europe/Stockholm', 'Australia/Lord_Howe', 'America/Nuuk'])(
    'Activity boundaries replay under TZ=%s',
    zone => {
      execFileSync(
        process.execPath,
        [
          require.resolve('jest/bin/jest'),
          '--selectProjects',
          'jsdom',
          '--runInBand',
          '--coverage=false',
          '--runTestsByPath',
          __filename,
        ],
        {
          cwd: path.resolve(__dirname, '../..'),
          env: { ...process.env, TZ: zone, AW_UI_DST_ZONE: zone },
          stdio: 'pipe',
          timeout: 90000,
        }
      );
    },
    95000
  );
}

const describeZone =
  process.env.AW_UI_DST_ZONE && process.env.AW_UI_DST_ZONE !== 'America/Nuuk'
    ? describe
    : describe.skip;
const Activity: any = ActivityComponent;
const Visualization: any = SelectableVisualization;
const Chart: any = TimelineBarChart;

const describeNuuk = process.env.AW_UI_DST_ZONE === 'America/Nuuk' ? describe : describe.skip;
describeNuuk('chart dates when the day-start gap crosses midnight', () => {
  test.each(['23:00', '23:30'])('keeps the requested dates with offset %s', offset => {
    const start = dateToTimeperiod('2026-03-28', offset).start;
    expect(moment(start).format('YYYY-MM-DD')).toBe('2026-03-29');
    const labels = (periodLength: [number, string], withOffset = true) =>
      Chart.computed.labels.call({
        timeperiod_start: start,
        timeperiod_length: periodLength,
        timeperiod_offset: withOffset ? offset : undefined,
      });
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    expect(labels([1, 'week'])).toEqual(
      Array.from({ length: 7 }, (_, day) => weekday.format(new Date(2026, 2, 28 + day, 12)))
    );
    expect(labels([3, 'days'])).toEqual(['Mar 28', 'Mar 29', 'Mar 30']);
    // Trends' plural weeks use one bar per week rather than one per day.
    expect(labels([2, 'weeks'])).toEqual(['Mar 28', 'Apr 4']);
    // Callers without an offset still label the actual start date.
    expect(labels([3, 'days'], false)).toEqual(['Mar 29', 'Mar 30', 'Mar 31']);
  });
});

describeZone('DST-gap Activity consumers', () => {
  const stockholm = process.env.AW_UI_DST_ZONE === 'Europe/Stockholm';
  const date = stockholm ? '2026-03-29' : '2026-10-04';
  const nextDate = stockholm ? '2026-03-30' : '2026-10-05';
  const tp = dateToTimeperiod(date, '02:00');
  const nextStart = dateToTimeperiod(nextDate, '02:00').start;

  test('entering exact interval keeps the displayed day end', () => {
    const pushPeriod = jest.fn();
    Activity.methods.setDate.call(
      { timeperiod: tp, periodLength: 'day', pushPeriod },
      date,
      'interval'
    );
    expect(pushPeriod).toHaveBeenCalledWith(
      'interval',
      `${moment.utc(tp.start).format()}..${moment.utc(nextStart).format()}`
    );
  });

  test('raw timeline uses the same bounds even with a date-only query option', () => {
    const bounds = Visualization.computed.timeline_daterange.call({
      activityStore: { query_options: { timeperiod: tp, date } },
    });
    expect(bounds.map(m => m.format())).toEqual([tp.start, nextStart]);
  });

  test('raw timeline keeps its one-day scope for a multi-day selection', () => {
    const bounds = Visualization.computed.timeline_daterange.call({
      activityStore: { query_options: { timeperiod: { ...tp, length: [7, 'days'] }, date } },
    });
    expect(bounds.map(m => m.format())).toEqual([tp.start, nextStart]);
  });

  test('chart labels and stack capacities match the query buckets', () => {
    const buckets = timeperiodsHoursOfPeriod(tp);
    const vm: any = {
      timeperiod_start: tp.start,
      timeperiod_length: tp.length,
      timeperiod_offset: tp.offset,
      clamp_hourly: true,
      datasets: [{ label: 'Work', data: buckets.map(() => 2) }],
    };
    vm.labels = Chart.computed.labels.call(vm);
    const data = Chart.computed.chartData.call(vm);
    expect(data.labels).toHaveLength(buckets.length);
    expect(data.datasets[0].data).toEqual(buckets.map(p => p.length[0]));
  });
});
