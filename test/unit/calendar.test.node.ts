import { calendarTimeBounds } from '~/util/calendar';

const event = (start: string, end: string) => ({ start, end });
const fullDay = { slotMinTime: '00:00:00', slotMaxTime: '24:00:00' };

test.each([
  ['2026-09-10T10:15:00', '2026-09-10T10:20:00', '10:00:00', '11:00:00'],
  ['2026-09-10T10:15:00', '2026-09-10T11:00:00', '10:00:00', '11:00:00'],
  ['2026-09-10T10:15:00', '2026-09-10T11:00:00.001', '10:00:00', '12:00:00'],
  ['2026-09-10T23:30:00', '2026-09-11T00:00:00', '23:00:00', '24:00:00'],
  ['2026-09-10T23:30:00', '2026-09-11T00:30:00', '00:00:00', '24:00:00'],
  ['2026-09-10T12:00:00', '2026-09-12T12:00:00', '00:00:00', '24:00:00'],
])('fits %s through %s without wrapping the upper bound', (start, end, min, max) => {
  expect(calendarTimeBounds([event(start, end)], true)).toEqual({
    slotMinTime: min,
    slotMaxTime: max,
  });
});

test('fits clock-time extents across the week independently of date order', () => {
  expect(
    calendarTimeBounds(
      [
        event('2026-09-10T16:00:00', '2026-09-10T18:00:00'),
        event('2026-09-11T08:15:00', '2026-09-11T09:00:00'),
      ],
      true
    )
  ).toEqual({ slotMinTime: '08:00:00', slotMaxTime: '18:00:00' });
});

test('falls back safely for empty, invalid, and nonpositive intervals or disabled fitting', () => {
  for (const events of [
    [],
    [event('bad', 'bad')],
    [event('2026-09-10T12:00:00', '2026-09-10T11:00:00')],
    [event('2026-09-10T12:00:00', '2026-09-10T12:00:00')],
  ]) {
    expect(calendarTimeBounds(events, true)).toEqual(fullDay);
  }
  expect(calendarTimeBounds([event('2026-09-10T10:00:00', '2026-09-10T11:00:00')], false)).toEqual(
    fullDay
  );
});
