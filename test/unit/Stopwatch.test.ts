import { createLocalVue, shallowMount } from '@vue/test-utils';
import { BootstrapVue } from 'bootstrap-vue';
import moment from 'moment';
import Stopwatch from '~/views/Stopwatch.vue';
import StopwatchEntry from '~/components/StopwatchEntry.vue';
import EventEditorComponent from '~/components/EventEditor.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const EventEditor: any = EventEditorComponent;

const localVue = createLocalVue();
localVue.use(BootstrapVue);

const event = (id, running = false) => ({
  id,
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, id)).toISOString(),
  duration: running ? 0 : 30,
  data: { running, label: `Timer ${id}` },
});
const oldRunning = event(1, true);
const stoppedEvents = Array.from({ length: 101 }, (_, i) => event(102 - i));
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function mountStopwatch(result = { running: [oldRunning], history: stoppedEvents }) {
  const aw = {
    ensureBucket: jest.fn().mockResolvedValue(undefined),
    getEvents: jest.fn().mockResolvedValue(stoppedEvents.slice(0, 100)),
    heartbeat: jest.fn().mockResolvedValue(undefined),
    req: { post: jest.fn().mockResolvedValue({ data: [result] }) },
  };
  const wrapper = shallowMount(Stopwatch, {
    localVue,
    mocks: { $aw: aw },
    stubs: {
      icon: true,
      'b-button': {
        template: '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>',
      },
    },
  });
  return { wrapper, aw };
}

function button(wrapper, label) {
  return wrapper.findAll('button').wrappers.find(b => b.text() === label);
}

describe('Stopwatch retrieval', () => {
  let wrapper;
  beforeEach(() => jest.spyOn(global, 'setInterval').mockImplementation(() => 1 as any));
  afterEach(() => {
    if (wrapper) wrapper.destroy();
    jest.restoreAllMocks();
  });

  test('finds an old running timer outside the newest 100 events', async () => {
    ({ wrapper } = mountStopwatch());
    await flush();
    expect(wrapper.vm.runningTimers.map(e => e.id)).toEqual([1]);
    expect(wrapper.vm.runningTimers[0].timestamp).toEqual(new Date(oldRunning.timestamp));
    expect(wrapper.vm.stoppedTimers).toHaveLength(100);
    expect(wrapper.findAllComponents({ name: 'StopwatchEntry' })).toHaveLength(101);
  });

  test('offers older history and keeps running timers visible while expanding it', async () => {
    let aw;
    ({ wrapper, aw } = mountStopwatch());
    await flush();
    const more = button(wrapper, 'Show more history');
    expect(more).toBeDefined();
    await more.trigger('click');
    await flush();
    expect(wrapper.vm.stoppedTimers).toHaveLength(101);
    expect(wrapper.vm.stoppedTimers[100].id).toBe(2);
    expect(wrapper.vm.runningTimers.map(e => e.id)).toEqual([1]);
    expect(button(wrapper, 'Show more history')).toBeUndefined();
    expect(aw.req.post).toHaveBeenCalledTimes(2);
  });

  test('bounds both groups independently and fetches fresh data after starting a timer', async () => {
    let aw;
    ({ wrapper, aw } = mountStopwatch());
    await flush();
    const [path, payload] = aw.req.post.mock.calls[0];
    expect(path).toBe('/0/query/');
    expect(payload.query[0]).toContain(
      'limit_events(filter_keyvals(events, "running", [true]), 101)'
    );
    expect(payload.query[0]).toContain(
      'limit_events(exclude_keyvals(events, "running", [true]), 101)'
    );
    const fresh = event(103, true);
    aw.req.post.mockResolvedValue({
      data: [{ running: [fresh, oldRunning], history: stoppedEvents }],
    });
    await wrapper.vm.startTimer('New timer');
    await flush();
    expect(aw.heartbeat).toHaveBeenCalledWith(
      'aw-stopwatch',
      1,
      expect.objectContaining({
        data: { running: true, label: 'New timer', tags: [] },
      })
    );
    expect(wrapper.vm.runningTimers.map(e => e.id)).toEqual([103, 1]);
  });

  test('offers more than 100 running timers without expanding history', async () => {
    let aw;
    const running = stoppedEvents.map(e => ({ ...e, data: { ...e.data, running: true } }));
    ({ wrapper, aw } = mountStopwatch({ running, history: [] }));
    await flush();
    expect(wrapper.vm.runningTimers).toHaveLength(100);
    await button(wrapper, 'Show more running timers').trigger('click');
    await flush();
    expect(wrapper.vm.runningTimers).toHaveLength(101);
    expect(button(wrapper, 'Show more running timers')).toBeUndefined();
    expect(aw.req.post.mock.calls[1][1].query[0]).toContain(
      'limit_events(filter_keyvals(events, "running", [true]), 201)'
    );
    expect(aw.req.post.mock.calls[1][1].query[0]).toContain(
      'limit_events(exclude_keyvals(events, "running", [true]), 101)'
    );
  });

  test('refreshes running and history groups after stopping an old timer', async () => {
    let aw;
    ({ wrapper, aw } = mountStopwatch());
    await flush();
    await button(wrapper, 'Show more history').trigger('click');
    await flush();
    const stopped = { ...oldRunning, duration: 600, data: { ...oldRunning.data, running: false } };
    aw.req.post.mockResolvedValue({
      data: [{ running: [], history: [...stoppedEvents, stopped] }],
    });
    await wrapper.findAllComponents({ name: 'StopwatchEntry' }).at(0).vm.$emit('update', stopped);
    await flush();
    expect(wrapper.vm.runningTimers).toHaveLength(0);
    expect(wrapper.vm.stoppedTimers.find(e => e.id === 1)).toEqual({
      ...stopped,
      timestamp: new Date(stopped.timestamp),
    });
    expect(wrapper.vm.historyLimit).toBe(200);
    expect(aw.req.post).toHaveBeenCalledTimes(3);
  });

  test('refills history after a confirmed deletion', async () => {
    let aw;
    ({ wrapper, aw } = mountStopwatch());
    await flush();
    aw.req.post.mockResolvedValue({
      data: [{ running: [oldRunning], history: stoppedEvents.slice(1) }],
    });
    await wrapper.vm.removeTimer(stoppedEvents[0]);
    await flush();
    expect(wrapper.vm.stoppedTimers).toHaveLength(100);
    expect(wrapper.vm.stoppedTimers.some(e => e.id === stoppedEvents[0].id)).toBe(false);
    expect(wrapper.vm.stoppedTimers[99].id).toBe(2);
    expect(button(wrapper, 'Show more history')).toBeUndefined();
  });

  test('retains rows after a failed expansion and retries the requested limit', async () => {
    let aw;
    ({ wrapper, aw } = mountStopwatch());
    await flush();
    aw.req.post.mockRejectedValueOnce(new Error('offline'));
    await button(wrapper, 'Show more history').trigger('click');
    await flush();
    expect(wrapper.text()).toContain('Unable to load stopwatch timers');
    expect(wrapper.vm.stoppedTimers).toHaveLength(100);
    expect(wrapper.vm.historyLimit).toBe(100);
    expect(button(wrapper, 'Show more history').attributes('disabled')).toBeUndefined();
    await button(wrapper, 'Retry').trigger('click');
    await flush();
    expect(aw.req.post.mock.calls[2][1].query[0]).toContain(
      'limit_events(exclude_keyvals(events, "running", [true]), 201)'
    );
    expect(wrapper.vm.stoppedTimers).toHaveLength(101);
    expect(wrapper.text()).not.toContain('Unable to load stopwatch timers');
  });

  test('preserves a pending expansion when a timer write refreshes the lists', async () => {
    let aw;
    ({ wrapper, aw } = mountStopwatch());
    await flush();
    let resolveExpansion;
    aw.req.post.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveExpansion = resolve;
        })
    );
    const expansion = wrapper.vm.getEvents(100, 200);
    await wrapper.vm.startTimer('New timer');
    expect(aw.req.post.mock.calls[2][1].query[0]).toContain(
      'limit_events(exclude_keyvals(events, "running", [true]), 201)'
    );
    resolveExpansion({ data: [{ running: [oldRunning], history: stoppedEvents }] });
    await expansion;
    expect(wrapper.vm.historyLimit).toBe(200);
    expect(wrapper.vm.stoppedTimers).toHaveLength(101);
  });

  test('does not let an older response overwrite a later refresh', async () => {
    let aw;
    ({ wrapper, aw } = mountStopwatch());
    await flush();
    let resolveOld;
    aw.req.post.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveOld = resolve;
        })
    );
    const oldRequest = wrapper.vm.getEvents();
    aw.req.post.mockResolvedValueOnce({ data: [{ running: [], history: [] }] });
    await wrapper.vm.getEvents();
    resolveOld({ data: [{ running: [oldRunning], history: stoppedEvents }] });
    await oldRequest;
    await flush();
    expect(wrapper.vm.events).toHaveLength(0);
    expect(wrapper.vm.refreshing).toBe(false);
  });

  test.each([0, 100])('does not offer extra pages for exactly %i history entries', async count => {
    ({ wrapper } = mountStopwatch({ running: [], history: stoppedEvents.slice(0, count) }));
    await flush();
    expect(wrapper.vm.stoppedTimers).toHaveLength(count);
    expect(button(wrapper, 'Show more history')).toBeUndefined();
    expect(button(wrapper, 'Show more running timers')).toBeUndefined();
    expect(wrapper.text()).toContain('No stopwatch running');
  });
});

describe('Stopwatch editor completion', () => {
  const editorVm = overrides => ({
    ...EventEditor.data(),
    ...EventEditor.methods,
    $refs: {},
    ...overrides,
  });

  test.each([
    ['save', 'saved', 'update'],
    ['delete', 'deleted', 'delete'],
  ])('forwards %s only after its completed event', async (early, completed, forwarded) => {
    const wrapper = shallowMount(StopwatchEntry, {
      localVue,
      propsData: { event: oldRunning, bucket_id: 'aw-stopwatch', now: moment() },
      stubs: { icon: true },
      filters: { shorttime: v => v, friendlyduration: v => v },
    });
    const editor = wrapper.findComponent(EventEditor);
    editor.vm.$emit(early, oldRunning);
    expect(wrapper.emitted(forwarded)).toBeUndefined();
    editor.vm.$emit(completed, oldRunning, 'aw-stopwatch');
    expect(wrapper.emitted(forwarded)).toEqual([[oldRunning]]);
    wrapper.destroy();
  });

  test('emits deleted only after the request succeeds, retaining the original target', async () => {
    let complete;
    const mutation = new Promise(resolve => {
      complete = resolve;
    });
    const vm = editorVm({
      event: oldRunning,
      bucket_id: 'aw-stopwatch',
      $emit: jest.fn(),
      $aw: { deleteEvent: jest.fn().mockReturnValue(mutation) },
    });
    const deleting = EventEditor.methods.delete_.call(vm);
    expect(vm.$emit).not.toHaveBeenCalled();
    expect(vm.$aw.deleteEvent).toHaveBeenCalledWith('aw-stopwatch', oldRunning.id);
    vm.event = event(999);
    vm.bucket_id = 'another-bucket';
    complete();
    await deleting;
    // The editor moved on, so only the completion for the original target is reported.
    expect(vm.$emit.mock.calls).toEqual([['deleted', oldRunning, 'aw-stopwatch']]);
  });

  test('does not emit completion when deletion fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const vm = editorVm({
      event: oldRunning,
      bucket_id: 'aw-stopwatch',
      $emit: jest.fn(),
      $aw: { deleteEvent: jest.fn().mockRejectedValue(new Error('offline')) },
    });
    await EventEditor.methods.delete_.call(vm);
    expect(vm.$emit).not.toHaveBeenCalled();
    expect(vm.error).toBe('offline');
    jest.restoreAllMocks();
  });
});
