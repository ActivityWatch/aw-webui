import moment from 'moment';
import { setAppLocale } from '~/i18n';

// Kept in its own file: vis-timeline must be evaluated for the first time inside
// the test, which any static import of it elsewhere in the file would prevent.
// The esnext ESM build is not transformed by jest; the peer UMD build is the same
// library code, including the module-level moment.locale(navigator.languages) call.
jest.mock('vis-timeline/esnext', () =>
  jest.requireActual('vis-timeline/peer/umd/vis-timeline-graph2d.js')
);

jest.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

describe('vis-timeline locale (#1324)', () => {
  afterEach(() => setAppLocale('en'));

  test('loading the timeline keeps the app locale for moment and the axis', async () => {
    setAppLocale('de');
    // vis-timeline runs moment.locale(navigator.languages) when first evaluated.
    await import('~/visualizations/VisTimeline.vue');
    expect(moment.locale()).toBe('de');
    expect(moment('2026-03-02').format('MMMM')).toBe('März');
  });
});
