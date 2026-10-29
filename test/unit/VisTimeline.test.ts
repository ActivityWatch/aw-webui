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

import VisTimelineComponent from '~/visualizations/VisTimeline.vue';
import EventEditorComponent from '~/components/EventEditor.vue';
import StopwatchEntryComponent from '~/components/StopwatchEntry.vue';
import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';
import { DataSet } from 'vis-data';

const DataSetUpdate = DataSet.prototype.update;

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const VisTimeline: any = VisTimelineComponent;
const EventEditor: any = EventEditorComponent;
const StopwatchEntry: any = StopwatchEntryComponent;

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

describe('timeline event editing (#984)', () => {
  const editorVm = overrides => ({
    ...EventEditor.data(),
    ...EventEditor.methods,
    event: { id: 7 },
    $refs: {},
    ...overrides,
  });

  test('EventEditor reports a saved event only after the server accepts it', async () => {
    const editedEvent = { id: 7, data: { title: 'updated' } };
    const replaceEvent = jest.fn().mockResolvedValue(undefined);
    const emit = jest.fn();

    await EventEditor.methods.save.call(
      editorVm({
        bucket_id: 'aw-watcher-window_test',
        editedEvent,
        $aw: { replaceEvent },
        $emit: emit,
      })
    );

    expect(replaceEvent).toHaveBeenCalledWith('aw-watcher-window_test', editedEvent);
    expect(emit).toHaveBeenNthCalledWith(1, 'save', editedEvent);
    expect(emit).toHaveBeenNthCalledWith(2, 'saved', editedEvent, 'aw-watcher-window_test');
  });

  test.each([
    ['Date', new Date('2026-10-16T10:00:00Z')],
    ['Moment', moment('2026-10-16T10:00:00Z')],
  ])('preserves a %s timestamp and isolates the in-flight save snapshot', async (_, timestamp) => {
    const editedEvent = {
      id: 7,
      timestamp,
      duration: 60,
      data: { running: true, label: 'original', nested: { value: 'original' } },
    };
    let finishWrite;
    const replaceEvent = jest.fn(
      (_bucketId: string, _event: any) =>
        new Promise(resolve => {
          finishWrite = resolve;
        })
    );
    const emit = jest.fn();
    const vm: any = editorVm({
      bucket_id: 'aw-stopwatch_test',
      editedEvent,
      $aw: { replaceEvent },
      $emit: emit,
    });
    const saving = EventEditor.methods.save.call(vm);
    const snapshot = replaceEvent.mock.calls[0][1];

    expect(emit).not.toHaveBeenCalled();
    const stopwatchEmit = jest.fn();
    StopwatchEntry.methods.save.call({ $emit: stopwatchEmit }, snapshot);
    const updatedEvent = stopwatchEmit.mock.calls[0][1];
    // Match the running-counter arithmetic in the StopwatchEntry template.
    expect(moment('2026-10-16T10:01:00Z').diff(updatedEvent.timestamp) / 1000).toBe(60);
    expect(snapshot.timestamp).toBeInstanceOf(timestamp.constructor);
    expect(snapshot.timestamp).not.toBe(timestamp);

    editedEvent.data.nested.value = 'changed';
    if (timestamp instanceof Date) {
      timestamp.setTime(0);
    } else {
      timestamp.add(1, 'hour');
    }
    vm.editedEvent = { id: 8, data: { label: 'another event' } };
    vm.bucket_id = 'aw-stopwatch_other';
    finishWrite();
    await saving;

    expect(snapshot.timestamp.valueOf()).toBe(Date.parse('2026-10-16T10:00:00Z'));
    expect(snapshot.data.nested.value).toBe('original');
    expect(emit).toHaveBeenNthCalledWith(1, 'save', snapshot);
    expect(emit).toHaveBeenNthCalledWith(2, 'saved', snapshot, 'aw-stopwatch_test');
  });

  test('does not report a saved event when the server rejects the update', async () => {
    const editedEvent = { id: 7, data: { title: 'updated' } };
    const emit = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const vm = editorVm({
      bucket_id: 'aw-watcher-window_test',
      editedEvent,
      $aw: { replaceEvent: jest.fn().mockRejectedValue(new Error('offline')) },
      $emit: emit,
    });

    await EventEditor.methods.save.call(vm);

    expect(emit).not.toHaveBeenCalled();
    expect(vm.error).toBe('offline');
    jest.restoreAllMocks();
  });

  test('uses a successfully saved event when rebuilding the timeline', () => {
    const original = {
      id: 7,
      timestamp: new Date('2026-09-17T10:00:00Z'),
      duration: 60,
      data: { title: 'before' },
    };
    const saved = { ...original, data: { title: 'after' } };
    const vm = {
      eventOverrides: { ['aw-watcher-window_test\0' + original.id]: saved },
    };

    expect(VisTimeline.methods.displayEvent.call(vm, 'aw-watcher-window_test', original)).toBe(
      saved
    );
    expect(VisTimeline.methods.displayEvent.call(vm, 'other-bucket', original)).toBe(original);
  });

  test('stores the saved event and immediately rebuilds the timeline', () => {
    const saved = { id: 7, data: { title: 'after' } };
    const emit = jest.fn();
    const vm = {
      editingEventBucket: 'aw-watcher-window_test',
      editingEvent: null,
      eventOverrides: {},
      pendingWindowRestore: null,
      timeline: null,
      $set: jest.fn((target, key, value) => {
        target[key] = value;
      }),
      $emit: emit,
      update: jest.fn(),
    };

    VisTimeline.methods.onEventSaved.call(vm, saved);

    expect(vm.eventOverrides['aw-watcher-window_test\0' + saved.id]).toBe(saved);
    expect(vm.editingEvent).toBe(saved);
    expect(vm.update).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('event-saved', saved);
  });
});

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

describe('timeline teardown', () => {
  test('destroys the library instance and releases the wheel listener', () => {
    const el = { removeEventListener: jest.fn() };
    const destroy = jest.fn();
    const vm = {
      $el: { querySelector: () => el },
      timeline: { destroy },
      onHorizontalWheel: jest.fn(),
    };
    VisTimeline.beforeDestroy.call(vm);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(vm.timeline).toBeNull();
    expect(el.removeEventListener).toHaveBeenCalledWith('wheel', vm.onHorizontalWheel, {
      capture: true,
    });
    VisTimeline.beforeDestroy.call(vm);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test('does not create an instance after destruction while nextTick is pending', () => {
    let mount;
    const vm = {
      $nextTick: callback => {
        mount = callback;
      },
      _isDestroyed: false,
    };
    VisTimeline.mounted.call(vm);
    vm._isDestroyed = true;
    expect(() => mount()).not.toThrow();
  });
});

// Exercise the viewport/DataSet integration without constructing browser layout.
test('panning preserves item IDs and editing uses the original bucket and event', async () => {
  const vm = { ...VisTimeline.data(), ...VisTimeline.methods };
  VisTimeline.created.call(vm);
  const event = {
    id: 42,
    timestamp: '2020-01-01T00:00:00Z',
    duration: 20,
    data: { status: 'not-afk' },
  };
  vm.bucketsFromEither = [{ id: 'afk-host', type: 'afkstatus', events: [event] }];
  vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
  const start = new Date(event.timestamp).getTime();
  vm.timeline = {
    getWindow: () => ({ start: new Date(start), end: new Date(start + 10000) }),
    setOptions: jest.fn(),
    setWindow: jest.fn(),
  };
  vm.update();
  const ids = vm.itemData.getIds();
  expect(ids).toHaveLength(1);
  expect(vm.itemData.get(ids[0]).content).toBe('Active');
  expect(vm.itemData.get(ids[0]).style).toContain('#7F6');
  expect(event.data.status).toBe('not-afk');
  const update = jest.spyOn(vm.itemData, 'update');
  vm.update(false);
  expect(update).not.toHaveBeenCalled();
  expect(vm.itemData.get(ids[0]).title).toBeUndefined();
  expect(vm.tooltipForItem(ids[0])).toContain('Duration');
  vm.$aw = { getEvent: jest.fn().mockResolvedValue(event) };
  vm.$nextTick = jest.fn();
  vm.editRefreshHintDismissed = () => true;
  await vm.onSelect({ items: ids });
  expect(vm.$aw.getEvent).toHaveBeenCalledWith('afk-host', 42);
  vm.timeline.getWindow = () => ({
    start: new Date(start + 100000),
    end: new Date(start + 110000),
  });
  vm.update(false);
  expect(vm.itemData.getIds()).toEqual([]);
  // The group remains present while passing through a gap.
  expect(vm.groupData.getIds()).toEqual(['afk-host']);
});

describe('VisTimeline scroll bounds (#996)', () => {
  const dayStart = moment('2026-09-24T00:00:00Z');
  const dayEnd = moment(dayStart).add(1, 'day');

  function makeVm(overrides = {}) {
    const vm: any = {
      ...VisTimeline.data(),
      ...VisTimeline.methods,
      showRowLabels: false,
      queriedInterval: [dayStart, dayEnd],
      updateTimelineWindow: undefined,
      ...overrides,
    };
    VisTimeline.created.call(vm);
    vm.bucketsFromEither = [
      {
        id: 'aw-watcher-afk_host',
        type: 'afkstatus',
        events: [
          {
            id: 1,
            timestamp: '2026-09-24T10:00:00Z',
            duration: 3600,
            data: { status: 'not-afk' },
          },
        ],
      },
    ];
    vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
    vm.timeline = {
      setOptions: jest.fn(),
      setWindow: jest.fn(),
      getWindow: () => ({ start: dayStart.toDate(), end: dayEnd.toDate() }),
    };
    return vm;
  }

  test('bounds scrolling to the queried interval without updateTimelineWindow', () => {
    const vm = makeVm();

    vm.update();

    expect(vm.options.min).toBe(dayStart.valueOf());
    expect(vm.options.max).toBe(dayEnd.valueOf());
    expect(vm.timeline.setOptions).toHaveBeenCalledWith(vm.options);
    // First bounds: show the whole queried day
    expect(vm.timeline.setWindow).toHaveBeenCalledWith(
      dayStart.valueOf(),
      dayEnd.valueOf(),
      expect.anything()
    );
  });

  test('keeps the zoomed window when the same interval is re-rendered', () => {
    const vm = makeVm();
    vm.update();
    vm.timeline.setWindow.mockClear();

    // e.g. a data refresh for the same day, with fresh moment instances
    vm.queriedInterval = [moment(dayStart), moment(dayEnd)];
    vm.update();

    expect(vm.timeline.setWindow).not.toHaveBeenCalled();
  });

  test('moves a zoomed window to the new day when the queried day changes', () => {
    const vm = makeVm();
    vm.update();
    vm.timeline.setWindow.mockClear();

    const nextStart = moment(dayStart).add(1, 'day');
    const nextEnd = moment(dayEnd).add(1, 'day');
    vm.queriedInterval = [nextStart, nextEnd];
    vm.update();

    expect(vm.options.min).toBe(nextStart.valueOf());
    expect(vm.options.max).toBe(nextEnd.valueOf());
    // vis-timeline doesn't re-clamp the window on setOptions, so without this
    // the view would stay on the previous day
    expect(vm.timeline.setWindow).toHaveBeenCalledWith(
      nextStart.valueOf(),
      nextEnd.valueOf(),
      expect.anything()
    );
  });

  test('also resets the visible window when updateTimelineWindow is set', () => {
    const vm = makeVm({ updateTimelineWindow: true });

    vm.update();

    expect(vm.options.min).toBe(dayStart.valueOf());
    expect(vm.options.max).toBe(dayEnd.valueOf());
    expect(vm.timeline.setWindow).toHaveBeenCalledWith(
      dayStart.valueOf(),
      dayEnd.valueOf(),
      expect.anything()
    );
  });

  test('leaves bounds unset when there is no queried interval', () => {
    const vm = makeVm({ queriedInterval: undefined });

    vm.update();

    expect(vm.options.min).toBeUndefined();
    expect(vm.options.max).toBeUndefined();
    expect(vm.timeline.setOptions).not.toHaveBeenCalled();
  });
});

describe('derived category row (#700)', () => {
  beforeEach(() => setActivePinia(createPinia()));

  function makeVm(categorizedEvents) {
    const vm = {
      ...VisTimeline.data(),
      ...VisTimeline.methods,
      showRowLabels: true,
      bucketsFromEither: [],
      categorizedEvents,
      $aw: { getEvent: jest.fn() },
    };
    VisTimeline.created.call(vm);
    vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
    vm.timeline = {
      setOptions: jest.fn(),
      setWindow: jest.fn(),
      getWindow: () => ({
        start: new Date('2026-10-18T09:00:00Z'),
        end: new Date('2026-10-18T11:00:00Z'),
      }),
    };
    return vm;
  }

  test('uses the assigned category color and keeps subsecond intervals in a single row', () => {
    const vm = makeVm([
      { timestamp: '2026-10-18T10:00:00Z', duration: 0.5, data: { $category: ['Uncategorized'] } },
    ]);
    vm.update();
    const items = vm.itemData.get();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ group: '__categorized__', content: 'Uncategorized' });
    expect(items[0].style).toContain('#CCC');
    expect(items[0].subgroup).toBeUndefined();
    expect(items[0].end - items[0].start).toBe(500);
  });

  test('creates a top-level category group without giving derived events an editor', async () => {
    const vm = makeVm([
      { timestamp: '2026-10-18T10:00:00Z', duration: 60, data: { $category: ['Work'] } },
    ]);
    vm.update();
    expect(vm.groups[0]).toMatchObject({ id: '__categorized__', content: 'Categorized' });
    await vm.onSelect({ items: vm.itemData.getIds() });
    expect(vm.$aw.getEvent).not.toHaveBeenCalled();
  });
});

describe('VisTimeline rendering cost', () => {
  const dayStart = moment('2026-09-24T00:00:00Z');
  const dayEnd = moment(dayStart).add(1, 'day');

  function makeVm(overrides = {}) {
    const vm = {
      ...VisTimeline.data(),
      ...VisTimeline.methods,
      showRowLabels: false,
      queriedInterval: [dayStart, dayEnd],
      ...overrides,
    };
    VisTimeline.created.call(vm);
    vm.bucketsFromEither = [
      {
        id: 'aw-watcher-afk_host',
        type: 'afkstatus',
        events: [
          { id: 1, timestamp: '2026-09-24T10:00:00Z', duration: 60, data: { status: 'afk' } },
        ],
      },
    ];
    vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
    vm.timeline = {
      setOptions: jest.fn(),
      setWindow: jest.fn(),
      // Still on the previous day: the items must come from the new window
      getWindow: () => ({
        start: moment(dayStart).subtract(1, 'day').toDate(),
        end: dayStart.toDate(),
      }),
    };
    return vm;
  }

  test('syncs the items for the new window before moving the window', () => {
    const vm = makeVm();
    const calls = [];
    jest.spyOn(vm.itemData, 'update').mockImplementation((items: any) => {
      calls.push(['items', items.length]);
      return DataSetUpdate.call(vm.itemData, items);
    });
    vm.timeline.setWindow.mockImplementation(() => calls.push(['window']));

    vm.update();

    expect(calls).toEqual([['items', 1], ['window']]);
  });

  test('only sets subgroups when grouping into swimlanes', () => {
    const vm = makeVm();
    vm.update();
    expect(vm.itemData.get()[0].subgroup).toBeUndefined();

    vm.swimlane = 'bucketType';
    vm.update();
    expect(vm.itemData.get()[0].subgroup).toBe('unknown');
  });
});

describe('panning within the rendered buffer', () => {
  function makeVm() {
    const vm = { ...VisTimeline.data(), ...VisTimeline.methods };
    VisTimeline.created.call(vm);
    vm.bucketsFromEither = [
      {
        id: 'afk',
        type: 'afkstatus',
        events: Array.from({ length: 40 }, (_, i) => ({
          id: i,
          timestamp: new Date(i * 1000).toISOString(),
          duration: 2,
          data: { status: 'afk' },
        })),
      },
    ];
    vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
    vm.hasInitialRange = true;
    vm.timeline = {
      getWindow: () => ({ start: new Date(10000), end: new Date(20000) }),
    };
    vm.update();
    return vm;
  }

  function move(vm, start, end = start + 10000) {
    vm.timeline.getWindow = () => ({ start: new Date(start), end: new Date(end) });
    vm.update(false);
    // Every event intersecting the actual viewport must remain available.
    for (const item of vm.eventIndex.entries) {
      if (item.start <= end && item.end >= start) {
        expect(vm.itemData.get(item.id)).not.toBeNull();
        expect(vm.itemEvents.get(item.id)).toBe(item);
      }
    }
  }

  test.each([1, -1])(
    'reuses the buffer then refills it when panning in direction %s',
    direction => {
      const vm = makeVm();
      const originalItems = vm.items;
      const originalEvents = vm.itemEvents;
      move(vm, 10000 + direction * 3000);
      expect(vm.items).toBe(originalItems);
      expect(vm.itemEvents).toBe(originalEvents);
      move(vm, 10000 + direction * 4100);
      expect(vm.items).not.toBe(originalItems);
      expect(vm.groupData.getIds()).toEqual(['afk']);
    }
  );

  test('syncs every zoom even when the viewport fits inside the old buffer', () => {
    const vm = makeVm();
    const originalItems = vm.items;
    move(vm, 11000, 19000);
    expect(vm.items).not.toBe(originalItems);
    const zoomedItems = vm.items;
    move(vm, 10000, 20000);
    expect(vm.items).not.toBe(zoomedItems);
  });

  test('data and swimlane refreshes bypass buffer reuse', () => {
    const vm = makeVm();
    vm.bucketsFromEither[0].events = [
      { id: 99, timestamp: new Date(12000).toISOString(), duration: 3, data: { status: 'afk' } },
    ];
    vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
    vm.update();
    expect(vm.itemData.get()).toHaveLength(1);
    expect(vm.itemEvents.values().next().value.event.id).toBe(99);
    vm.swimlane = 'bucketType';
    vm.update();
    expect(vm.itemData.get()[0].subgroup).toBe('unknown');
  });
});

test('a saved edit replaces the rendered event and keeps the window in place', () => {
  const vm = { ...VisTimeline.data(), ...VisTimeline.methods };
  VisTimeline.created.call(vm);
  const bucketId = 'aw-watcher-window_test';
  const event = {
    id: 7,
    timestamp: '2026-09-17T10:00:00Z',
    duration: 60,
    data: { app: 'Code', title: 'before' },
  };
  vm.bucketsFromEither = [{ id: bucketId, type: 'currentwindow', events: [event] }];
  const start = Date.parse(event.timestamp);
  const view = { start: new Date(start - 1000), end: new Date(start + 120000) };
  vm.timeline = { getWindow: () => view, setOptions: jest.fn(), setWindow: jest.fn() };
  vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
  vm.update();
  vm.timeline.setWindow.mockClear();

  vm.eventOverrides[`${bucketId}\0${event.id}`] = {
    ...event,
    data: { app: 'Code', title: 'after' },
  };
  vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
  vm.pendingWindowRestore = view;
  vm.update();

  const [id] = vm.itemData.getIds();
  expect(vm.itemEvents.get(id).event.data.title).toBe('after');
  expect(vm.timeline.setWindow).toHaveBeenCalledWith(view.start.valueOf(), view.end.valueOf(), {
    animation: false,
  });
  expect(vm.pendingWindowRestore).toBeNull();
});

// Labels are presentation, never event or color identities.
test('locale changes refresh real DataSet labels without resetting IDs, colors or viewport', () => {
  const { i18n, setAppLocale } = require('~/i18n');
  const original = i18n.getLocaleMessage('de');
  setAppLocale('en');
  const vm = { ...VisTimeline.data(), ...VisTimeline.methods };
  VisTimeline.created.call(vm);
  const event = {
    id: 42,
    timestamp: '2020-01-01T00:00:00Z',
    duration: 20,
    data: { status: 'not-afk' },
  };
  vm.bucketsFromEither = [{ id: 'afk-host', type: 'afkstatus', events: [event] }];
  vm.eventIndex = VisTimeline.computed.eventIndex.call(vm);
  const start = new Date(event.timestamp).getTime();
  vm.timeline = {
    getWindow: () => ({ start: new Date(start), end: new Date(start + 10000) }),
    setOptions: jest.fn(),
    setWindow: jest.fn(),
  };
  try {
    vm.update();
    const [id] = vm.itemData.getIds();
    const before = vm.itemData.get(id);
    expect(before.content).toBe('Active');
    vm.timeline.getWindow = () => ({ start: new Date(start), end: new Date(start + 20000) });
    vm.timeline.setWindow.mockClear();
    i18n.mergeLocaleMessage('de', { common: { active: 'Aktiv' } });
    setAppLocale('de');
    VisTimeline.watch['$i18n.locale'].call(vm);
    expect(vm.itemData.get(id).content).toBe('Aktiv');
    expect(vm.itemData.get(id).style).toBe(before.style);
    expect(vm.itemData.getIds()).toEqual([id]);
    expect(vm.timeline.setWindow).not.toHaveBeenCalled();
    expect(event.data.status).toBe('not-afk');
  } finally {
    i18n.setLocaleMessage('de', original);
    setAppLocale('en');
  }
});
