import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';

import Bucket from '~/views/Bucket.vue';
import EventList from '~/visualizations/EventList.vue';
import EventEditor from '~/components/EventEditor.vue';

const mockCountEvents = jest.fn();
const mockGetBucketWithEvents = jest.fn();
const buckets = ['A', 'B'].map(id => ({
  id,
  type: 'test',
  client: 'test',
  hostname: 'test',
  metadata: { end: '2026-10-01T12:00:00Z' },
}));

jest.mock('~/util/awclient', () => ({
  getClient: () => ({ countEvents: mockCountEvents }),
}));
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
    getBucket: id => buckets.find(b => b.id === id),
    getBucketWithEvents: mockGetBucketWithEvents,
  }),
}));

const localVue = createLocalVue();
localVue.use(BootstrapVue);
localVue.component('aw-eventlist', EventList);
for (const filter of ['iso8601', 'friendlytime', 'friendlyduration']) {
  localVue.filter(filter, v => String(v));
}

const event = (id = 11) => ({
  id,
  timestamp: '2026-10-01T12:00:00Z',
  duration: 60,
  data: { title: `event ${id}` },
});
const range = () => ['start', 'end'].map(value => ({ format: () => value }));
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

// Mount the real Bucket -> EventList -> EventEditor templates. Only unrelated
// visualizations/controls and the server transport are fixtures.
function mountBucket() {
  const server = { A: [event(), event(12)], B: [event()] };
  mockGetBucketWithEvents.mockImplementation(async ({ id }) => ({
    ...buckets.find(b => b.id === id),
    events: server[id].map(e => ({ ...e, data: { ...e.data } })),
  }));
  mockCountEvents.mockImplementation(async id => server[id].length);
  const $aw = {
    getEvent: jest.fn(async (id, eid) => {
      const found = server[id].find(e => e.id === eid);
      return { ...found, data: { ...found.data } };
    }),
    deleteEvent: jest.fn(async (id, eid) => {
      server[id] = server[id].filter(e => e.id !== eid);
    }),
    replaceEvent: jest.fn().mockResolvedValue(undefined),
  };
  const wrapper: any = mount(Bucket, {
    localVue,
    propsData: { id: 'A' },
    mocks: { $aw },
    stubs: {
      'input-timeinterval': {
        name: 'TimeIntervalFixture',
        template: '<div />',
        mounted() {
          this.$emit('input', range());
        },
      },
      'vis-timeline': {
        name: 'TimelineFixture',
        props: ['buckets'],
        template: '<div class="timeline" />',
      },
      datetime: true,
      icon: true,
    },
  });
  return { wrapper, server, $aw };
}

async function editFirst(wrapper) {
  const list = wrapper.findComponent(EventList);
  await list.find('li button').trigger('click');
  await flush();
  return list.findComponent(EventEditor);
}

function expectEvents(wrapper, ids) {
  expect(wrapper.vm.events.map(e => e.id)).toEqual(ids);
  expect(
    wrapper
      .findComponent(EventList)
      .props('events')
      .map(e => e.id)
  ).toEqual(ids);
  expect(wrapper.find('.timeline').exists()).toBe(true);
  expect(
    wrapper
      .findComponent({ name: 'TimelineFixture' })
      .props('buckets')[0]
      .events.map(e => e.id)
  ).toEqual(ids);
  expect(wrapper.findAll('li')).toHaveLength(ids.length);
}

describe('confirmed Bucket deletion', () => {
  const wrappers = [];
  beforeEach(() => {
    mockCountEvents.mockReset();
    mockGetBucketWithEvents.mockReset();
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });
  afterEach(() => {
    wrappers.forEach(w => w.destroy());
    wrappers.length = 0;
    jest.restoreAllMocks();
  });
  function setup() {
    const result = mountBucket();
    wrappers.push(result.wrapper);
    return result;
  }

  test('confirmed deletion reconciles list, timeline and total once without mutating props', async () => {
    const { wrapper, server, $aw } = setup();
    await flush();
    const editor: any = await editFirst(wrapper);
    const originalEvents = wrapper.vm.events;
    await editor.vm.delete_();
    await flush();
    expect($aw.deleteEvent).toHaveBeenCalledTimes(1);
    expect(server.A.map(e => e.id)).toEqual([12]);
    expectEvents(wrapper, [12]);
    expect(originalEvents.map(e => e.id)).toEqual([11, 12]);
    expect(wrapper.vm.eventcount).toBe(1);
  });

  test('failure keeps the row and draft retryable; a successful retry removes it', async () => {
    const { wrapper, $aw } = setup();
    await flush();
    const editor: any = await editFirst(wrapper);
    editor.vm.editedEvent.data.title = 'unsaved input';
    $aw.deleteEvent.mockRejectedValueOnce(new Error('offline'));
    await editor.vm.delete_();
    await flush();
    expectEvents(wrapper, [11, 12]);
    expect(wrapper.vm.eventcount).toBe(2);
    expect(editor.vm.error).toBe('offline');
    expect(editor.vm.editedEvent.data.title).toBe('unsaved input');
    expect(editor.emitted('deleted')).toBeUndefined();
    await editor.vm.delete_();
    await flush();
    expectEvents(wrapper, [12]);
    expect(wrapper.vm.eventcount).toBe(1);
    expect(editor.emitted('deleted')).toHaveLength(1);
  });

  test('late deletion from A cannot remove B event with the same id', async () => {
    const { wrapper, server, $aw } = setup();
    await flush();
    const editor: any = await editFirst(wrapper);
    const request = deferred();
    $aw.deleteEvent.mockImplementationOnce(async () => {
      await request.promise;
      server.A = server.A.filter(e => e.id !== 11);
    });
    const deletion = editor.vm.delete_();
    await wrapper.setProps({ id: 'B' });
    await flush();
    expectEvents(wrapper, [11]);
    request.resolve();
    await deletion;
    await flush();
    expectEvents(wrapper, [11]);
    expect(wrapper.vm.eventcount).toBe(1);
    expect(editor.emitted('deleted')[0][1]).toBe('A');
  });

  test('a deletion still reconciles its bucket after the editor selects another event', async () => {
    const { wrapper, server, $aw } = setup();
    await flush();
    const editor: any = await editFirst(wrapper);
    const request = deferred();
    $aw.deleteEvent.mockImplementationOnce(async () => {
      await request.promise;
      server.A = server.A.filter(e => e.id !== 11);
    });
    const deletion = editor.vm.delete_();
    await wrapper.findComponent(EventList).findAll('li button').at(1).trigger('click');
    await flush();
    request.resolve();
    await deletion;
    await flush();
    expectEvents(wrapper, [12]);
    expect(wrapper.vm.eventcount).toBe(1);
    expect(editor.props('event').id).toBe(12);
    expect(editor.emitted('delete')).toBeUndefined();
    expect(editor.emitted('deleted')).toHaveLength(1);
  });

  test('failed refreshes retain the confirmed local removal and invalidate old snapshots', async () => {
    const { wrapper } = setup();
    await flush();
    const editor: any = await editFirst(wrapper);
    const oldEvents = deferred();
    const oldCount = deferred();
    mockGetBucketWithEvents.mockReturnValueOnce(oldEvents.promise);
    mockCountEvents.mockReturnValueOnce(oldCount.promise);
    const loading = wrapper.vm.getEvents('A');
    const counting = wrapper.vm.getEventCount('A');
    mockGetBucketWithEvents.mockRejectedValueOnce(new Error('refresh offline'));
    mockCountEvents.mockRejectedValueOnce(new Error('refresh offline'));
    jest.spyOn(console, 'warn').mockImplementation(jest.fn());
    await editor.vm.delete_();
    await flush();
    oldEvents.resolve({ events: [event(), event(12)] });
    oldCount.resolve(2);
    await Promise.all([loading, counting]);
    await flush();
    expectEvents(wrapper, [12]);
    expect(wrapper.vm.eventcount).toBe(1);
    expect(console.warn).toHaveBeenCalledWith(
      '[bucket] Failed to refresh after deletion:',
      expect.any(Error)
    );
  });

  test.each(['failure', 'success', 'empty'])(
    'recent-event refresh %s preserves survivors until the complete refresh succeeds',
    async outcome => {
      const { wrapper, server } = setup();
      await flush();
      mockGetBucketWithEvents.mockImplementation(async ({ id, limit }) => ({
        events: limit ? server[id].map(e => ({ ...e })) : [],
      }));
      await wrapper.vm.getEvents('A');
      await flush();
      expectEvents(wrapper, [11, 12]);
      expect(wrapper.vm.showingMostRecent).toBe(true);
      const lastEventTime = wrapper.vm.lastEventTime;
      const editor: any = await editFirst(wrapper);
      const recent = deferred();
      mockGetBucketWithEvents
        .mockResolvedValueOnce({ events: [] })
        .mockReturnValueOnce(recent.promise);
      jest.spyOn(console, 'warn').mockImplementation(jest.fn());
      await editor.vm.delete_();
      await flush();
      expect(mockGetBucketWithEvents).toHaveBeenLastCalledWith({ id: 'A', limit: 100 });
      expectEvents(wrapper, [12]);
      expect(wrapper.vm.eventcount).toBe(1);
      expect(wrapper.vm.showingMostRecent).toBe(true);
      expect(wrapper.vm.lastEventTime).toBe(lastEventTime);

      if (outcome === 'failure') recent.reject(new Error('recent offline'));
      else recent.resolve({ events: outcome === 'success' ? [event(12), event(13)] : [] });
      await flush();
      expectEvents(wrapper, outcome === 'success' ? [12, 13] : outcome === 'empty' ? [] : [12]);
      expect(wrapper.vm.showingMostRecent).toBe(outcome !== 'empty');
      if (outcome === 'failure') {
        expect(wrapper.vm.lastEventTime).toBe(lastEventTime);
        expect(console.warn).toHaveBeenCalledWith(
          '[bucket] Failed to load most recent events:',
          expect.any(Error)
        );
      }
    }
  );

  test.each([false, true])(
    'changing range clears old rows and fallback state (previous fallback: %s)',
    async previousFallback => {
      const { wrapper } = setup();
      await flush();
      if (previousFallback) {
        mockGetBucketWithEvents
          .mockResolvedValueOnce({ events: [] })
          .mockResolvedValueOnce({ events: [event(), event(12)] });
        await wrapper.vm.getEvents('A');
        await flush();
      }
      expectEvents(wrapper, [11, 12]);
      expect(wrapper.vm.showingMostRecent).toBe(previousFallback);
      const recent = deferred();
      mockGetBucketWithEvents
        .mockResolvedValueOnce({ events: [] })
        .mockReturnValueOnce(recent.promise);
      jest.spyOn(console, 'warn').mockImplementation(jest.fn());

      const nextRange = ['new start', 'new end'].map(value => ({ format: () => value }));
      wrapper.findComponent({ name: 'TimeIntervalFixture' }).vm.$emit('input', nextRange);
      await flush();
      expect(mockGetBucketWithEvents).toHaveBeenCalledWith({
        id: 'A',
        start: 'new start',
        end: 'new end',
      });
      expect(mockGetBucketWithEvents).toHaveBeenLastCalledWith({ id: 'A', limit: 100 });
      expectEvents(wrapper, []);
      expect(wrapper.vm.showingMostRecent).toBe(false);
      expect(wrapper.vm.lastEventTime).toBeNull();

      recent.reject(new Error('recent offline'));
      await flush();
      expectEvents(wrapper, []);
      expect(wrapper.vm.showingMostRecent).toBe(false);
      expect(wrapper.vm.lastEventTime).toBeNull();
      expect(wrapper.vm.eventcount).toBe(2);

      mockGetBucketWithEvents.mockResolvedValueOnce({ events: [event(13)] });
      await wrapper.vm.getEvents('A');
      await flush();
      expectEvents(wrapper, [13]);
    }
  );

  test('a duplicate confirmed notification cannot decrement the total twice', async () => {
    const { wrapper } = setup();
    await flush();
    const editor: any = await editFirst(wrapper);
    const deleted = editor.props('event');
    await editor.vm.delete_();
    await flush();
    await wrapper.vm.removeEvent(deleted, 'A');
    await flush();
    expectEvents(wrapper, [12]);
    expect(wrapper.vm.eventcount).toBe(1);
  });

  test('a pre-delete events/count load cannot restore the deleted event or stale total', async () => {
    const { wrapper } = setup();
    await flush();
    const editor: any = await editFirst(wrapper);
    const oldEvents = deferred();
    const oldCount = deferred();
    mockGetBucketWithEvents.mockReturnValueOnce(oldEvents.promise);
    mockCountEvents.mockReturnValueOnce(oldCount.promise);
    const loading = wrapper.vm.getEvents('A');
    const counting = wrapper.vm.getEventCount('A');
    await editor.vm.delete_();
    await flush();
    oldEvents.resolve({ events: [event(), event(12)] });
    oldCount.resolve(2);
    await Promise.all([loading, counting]);
    await flush();
    expectEvents(wrapper, [12]);
    expect(wrapper.vm.eventcount).toBe(1);
  });

  test('deletion preserves the display limit and the authoritative full-bucket total', async () => {
    const { wrapper, server } = setup();
    server.A = Array.from({ length: 120 }, (_, i) => event(i + 1));
    await flush();
    expect(wrapper.findAll('li')).toHaveLength(100);
    const editor: any = await editFirst(wrapper);
    await editor.vm.delete_();
    await flush();
    expect(wrapper.vm.events).toHaveLength(119);
    expect(wrapper.vm.eventcount).toBe(119);
    expect(wrapper.findAll('li')).toHaveLength(100);
    expect(wrapper.vm.events[0].id).toBe(2);
  });

  test('successful saves still update the row, and deleting the last row leaves an empty list', async () => {
    const { wrapper } = setup();
    await flush();
    const editor: any = await editFirst(wrapper);
    editor.vm.editedEvent.data.title = 'saved';
    await editor.vm.save();
    await flush();
    expect(wrapper.vm.events[0].data.title).toBe('saved');
    expect(wrapper.vm.eventcount).toBe(2);
    await editor.vm.delete_();
    await flush();
    const lastEditor: any = await editFirst(wrapper);
    await lastEditor.vm.delete_();
    await flush();
    expectEvents(wrapper, []);
    expect(wrapper.vm.eventcount).toBe(0);
  });
});
