/**
 * Regression tests for aw-webui#847 — timeline zoom should stay anchored
 * to the cursor position, not drift on each wheel event.
 *
 * Fix landed in PR #860 via two changes:
 *   1. `preferZoom: true` in the vis-timeline options (prevents the pan that
 *      follows a vertical zoom step when horizontalScroll is also enabled).
 *   2. A custom `onHorizontalWheel` handler that intercepts dominant-horizontal
 *      wheel events and manually pans the window without involving vis-timeline's
 *      built-in horizontal-scroll path.
 */

import VisTimeline from '~/visualizations/VisTimeline.vue';

// vis-timeline creates a real DOM timeline; mock the entire import so unit
// tests run in jsdom without a full browser canvas/resize-observer stack.
jest.mock('vis-timeline/esnext', () => ({
  Timeline: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    setWindow: jest.fn(),
    getWindow: jest.fn(),
    destroy: jest.fn(),
  })),
}));
jest.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeTimeline() {
  const start = new Date(1_000_000);
  const end = new Date(1_000_000 + 3_600_000); // 1-hour window
  return {
    getWindow: jest.fn(() => ({
      start,
      end,
    })),
    setWindow: jest.fn(),
  };
}

function makeWheelEvent(overrides = {}) {
  return {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0, // DOM_DELTA_PIXEL
    preventDefault: jest.fn(),
    stopImmediatePropagation: jest.fn(),
    ...overrides,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('VisTimeline zoom-anchor regression (#847)', () => {
  describe('preferZoom option', () => {
    test('is set to true so vis-timeline does not pan after a vertical zoom step', () => {
      // Calling data() without a full Vue instance is safe here because the
      // options object is a plain literal that does not access `this`.
      const data = VisTimeline.data.call({});
      expect(data.options.preferZoom).toBe(true);
    });
  });

  describe('onHorizontalWheel', () => {
    const { onHorizontalWheel } = VisTimeline.methods;

    test('returns early (no pan) when timeline is not yet initialised', () => {
      const vm = { timeline: null };
      const event = makeWheelEvent({ deltaX: 100, deltaY: 0 });

      onHorizontalWheel.call(vm, event);

      // Cannot assert setWindow here because vm.timeline is intentionally null.
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns early when vertical component dominates (deltaY > deltaX)', () => {
      const vm = { timeline: makeTimeline() };
      const event = makeWheelEvent({ deltaX: 10, deltaY: 50 });

      onHorizontalWheel.call(vm, event);

      expect(vm.timeline.setWindow).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns early when both components are equal (deltaY == deltaX)', () => {
      const vm = { timeline: makeTimeline() };
      const event = makeWheelEvent({ deltaX: 30, deltaY: 30 });

      onHorizontalWheel.call(vm, event);

      expect(vm.timeline.setWindow).not.toHaveBeenCalled();
    });

    test('pans the window when horizontal component dominates (deltaX > deltaY)', () => {
      const startMs = 1_000_000;
      const windowMs = 3_600_000;
      const vm = { timeline: makeTimeline() };
      const event = makeWheelEvent({ deltaX: 120, deltaY: 0 });

      onHorizontalWheel.call(vm, event);

      expect(vm.timeline.setWindow).toHaveBeenCalledTimes(1);
      const [newStart, newEnd, opts] = vm.timeline.setWindow.mock.calls[0];
      // diff = (120 / 120) * (3600000 / 20) = 180000 ms
      const expectedDiff = (120 / 120) * (windowMs / 20);
      expect(newStart.getTime()).toBeCloseTo(startMs + expectedDiff, -2);
      expect(newEnd.getTime()).toBeCloseTo(startMs + windowMs + expectedDiff, -2);
      expect(opts).toEqual({ animation: false });
    });

    test('calls preventDefault and stopImmediatePropagation on a handled event', () => {
      const vm = { timeline: makeTimeline() };
      const event = makeWheelEvent({ deltaX: 120, deltaY: 0 });

      onHorizontalWheel.call(vm, event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(event.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    });

    test('scales deltaX by 40 px/line in DOM_DELTA_LINE mode', () => {
      const startMs = 1_000_000;
      const windowMs = 3_600_000;
      const vm = { timeline: makeTimeline() };
      // deltaMode 1 = DOM_DELTA_LINE; 3 lines * 40 px/line = 120 px effective
      const event = makeWheelEvent({ deltaX: 3, deltaY: 0, deltaMode: 1 });

      onHorizontalWheel.call(vm, event);

      const [newStart] = vm.timeline.setWindow.mock.calls[0];
      const expectedDiff = ((3 * 40) / 120) * (windowMs / 20);
      expect(newStart.getTime()).toBeCloseTo(startMs + expectedDiff, -2);
    });

    test('scales deltaX by 800 px/page in DOM_DELTA_PAGE mode', () => {
      const startMs = 1_000_000;
      const windowMs = 3_600_000;
      const vm = { timeline: makeTimeline() };
      // deltaMode 2 = DOM_DELTA_PAGE; 1 page * 800 px/page = 800 px effective
      const event = makeWheelEvent({ deltaX: 1, deltaY: 0, deltaMode: 2 });

      onHorizontalWheel.call(vm, event);

      const [newStart] = vm.timeline.setWindow.mock.calls[0];
      const expectedDiff = ((1 * 800) / 120) * (windowMs / 20);
      expect(newStart.getTime()).toBeCloseTo(startMs + expectedDiff, -2);
    });
  });
});

describe('VisTimeline scroll bounds (#996)', () => {
  const moment = require('moment');
  const { update } = VisTimeline.methods;
  const dayStart = moment('2026-09-24T00:00:00Z');
  const dayEnd = moment(dayStart).add(1, 'day');

  function makeVm(overrides = {}) {
    return {
      timeline: { setOptions: jest.fn(), setWindow: jest.fn(), setData: jest.fn() },
      options: {},
      bucketsFromEither: [{ id: 'aw-watcher-window_host' }],
      chartData: [
        {
          bucketId: 'aw-watcher-window_host',
          title: 'app',
          tooltip: 'app',
          start: new Date('2026-09-24T10:00:00Z'),
          end: new Date('2026-09-24T11:00:00Z'),
          color: '#ccc',
          swimlane: '',
        },
      ],
      showRowLabels: false,
      queriedInterval: [dayStart, dayEnd],
      updateTimelineWindow: undefined,
      ...overrides,
    };
  }

  test('bounds scrolling to the queried interval without updateTimelineWindow', () => {
    const vm = makeVm();

    update.call(vm);

    expect(vm.options.min).toBe(dayStart);
    expect(vm.options.max).toBe(dayEnd);
    expect(vm.timeline.setOptions).toHaveBeenCalledWith(vm.options);
    // The visible window is left alone unless the caller asks for it
    expect(vm.timeline.setWindow).not.toHaveBeenCalled();
  });

  test('also resets the visible window when updateTimelineWindow is set', () => {
    const vm = makeVm({ updateTimelineWindow: true });

    update.call(vm);

    expect(vm.options.min).toBe(dayStart);
    expect(vm.options.max).toBe(dayEnd);
    expect(vm.timeline.setWindow).toHaveBeenCalledWith(dayStart, dayEnd);
  });

  test('leaves bounds unset when there is no queried interval', () => {
    const vm = makeVm({ queriedInterval: undefined });

    update.call(vm);

    expect(vm.options.min).toBeUndefined();
    expect(vm.options.max).toBeUndefined();
    expect(vm.timeline.setOptions).not.toHaveBeenCalled();
  });
});
