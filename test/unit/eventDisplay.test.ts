import { i18n, setAppLocale } from '~/i18n';
import { getEventDisplayTitle } from '~/util/eventDisplay';
import { getTitleAttr, getCategoryColorFromEvent } from '~/util/color';

const event = (idleStatus: string) => ({
  id: 17,
  timestamp: '2026-10-29T09:00:00Z',
  duration: 60,
  data: { status: idleStatus },
});

beforeEach(() => setAppLocale('en'));
afterEach(() => setAppLocale('en'));

test.each([
  ['afk', 'Inactive'],
  ['not-afk', 'Active'],
  ['unknown', 'unknown'],
  ['', ''],
])('presents idle status %s without changing raw data or color identity', (idleStatus, label) => {
  const bucket = { type: 'afkstatus' };
  const e = event(idleStatus);
  const json = JSON.stringify(e);
  const color = getCategoryColorFromEvent(bucket, e);
  expect(getEventDisplayTitle(bucket, e)).toBe(label);
  expect(getTitleAttr(bucket, e)).toBe(idleStatus);
  expect(getCategoryColorFromEvent(bucket, e)).toBe(color);
  expect(JSON.stringify(e)).toBe(json);
});

test('does not interpret an unrelated event field as idle status', () => {
  const e = { ...event('afk'), data: { app: 'afk', status: 'afk' } };
  expect(getEventDisplayTitle({ type: 'currentwindow' }, e)).toBe('afk');
});

test('uses translated status labels and English fallback without changing selected locale', () => {
  setAppLocale('de');
  expect(getEventDisplayTitle({ type: 'afkstatus' }, event('afk'))).toBe('Inactive');
  expect(i18n.locale).toBe('de');
  const original = i18n.getLocaleMessage('de');
  try {
    i18n.mergeLocaleMessage('de', { common: { inactive: 'Inaktiv' } });
    expect(getEventDisplayTitle({ type: 'afkstatus' }, event('afk'))).toBe('Inaktiv');
  } finally {
    i18n.setLocaleMessage('de', original);
  }
});
