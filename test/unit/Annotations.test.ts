import { execFileSync } from 'child_process';
import path from 'path';
import moment from 'moment';
import { createLocalVue, shallowMount, Wrapper } from '@vue/test-utils';
import { BootstrapVue } from 'bootstrap-vue';
import Annotations from '~/views/Annotations.vue';
import {
  annotationBucketId,
  draftToEvent,
  formatTags,
  parseTags,
  validateDraft,
} from '~/util/annotations';

const localVue = createLocalVue();
localVue.use(BootstrapVue);
localVue.filter('shorttime', value => moment(value).format('HH:mm'));
beforeEach(() => jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('annotation helpers', () => {
  test('parseTags trims, drops empties and de-duplicates', () => {
    expect(parseTags(' a, b ,, a ,c')).toEqual(['a', 'b', 'c']);
    expect(parseTags('')).toEqual([]);
  });

  test('formatTags tolerates non-array data', () => {
    expect(formatTags(['a', 'b'])).toBe('a, b');
    expect(formatTags('a')).toBe('');
    expect(formatTags(undefined)).toBe('');
  });

  test('bucket id is per host', () => {
    expect(annotationBucketId('box')).toBe('aw-annotations_box');
  });

  test('validateDraft rejects bad ranges and empty annotations', () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const end = new Date('2026-01-01T11:00:00Z');
    expect(validateDraft({ start, end, tags: 'a', note: '' })).toBeNull();
    expect(validateDraft({ start, end, tags: '', note: ' hi ' })).toBeNull();
    expect(validateDraft({ start, end, tags: ' , ', note: '  ' })).toBe('empty');
    expect(validateDraft({ start: end, end: start, tags: 'a', note: '' })).toBe('invalidRange');
    expect(validateDraft({ start, end: start, tags: 'a', note: '' })).toBe('invalidRange');
    expect(validateDraft({ start: new Date('x'), end, tags: 'a', note: '' })).toBe('invalidRange');
  });

  test('draftToEvent stores tags as an array and omits a blank note', () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const end = new Date('2026-01-01T10:30:00Z');
    expect(draftToEvent({ start, end, tags: 'a, b', note: '  ' })).toEqual({
      timestamp: start,
      duration: 1800,
      data: { tags: ['a', 'b'] },
    });
    expect(draftToEvent({ start, end, tags: '', note: ' hi ' }).data).toEqual({
      tags: [],
      note: 'hi',
    });
  });
});

const stored = (id, tags, note?) => ({
  id,
  timestamp: new Date(Date.UTC(2026, 0, 1, 10, id)).toISOString(),
  duration: 600,
  data: note ? { tags, note } : { tags },
});

function mountView(events = [stored(1, ['client-x'], 'call')], overrides = {}) {
  const aw = {
    getInfo: jest.fn().mockResolvedValue({ hostname: 'box' }),
    ensureBucket: jest.fn().mockResolvedValue(undefined),
    getEvents: jest.fn().mockResolvedValue(events),
    insertEvent: jest.fn().mockResolvedValue(undefined),
    replaceEvent: jest.fn().mockResolvedValue(undefined),
    deleteEvent: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  // The repository's .vue shim exposes only Vue, not this options-API view's members.
  const wrapper: Wrapper<any> = shallowMount(Annotations, {
    localVue,
    mocks: { $aw: aw, $t: (k: string) => k },
    stubs: { icon: true },
  });
  return { wrapper, aw };
}

describe('Annotations view', () => {
  test('creates the per-host bucket and loads its events', async () => {
    const { wrapper, aw } = mountView();
    await flush();
    expect(aw.ensureBucket).toHaveBeenCalledWith('aw-annotations_box', 'annotation', 'box');
    expect(aw.getEvents).toHaveBeenCalledWith('aw-annotations_box', { limit: 101 });
    expect(wrapper.vm.events).toHaveLength(1);
    expect(wrapper.vm.hasMore).toBe(false);
  });

  test('adds an annotation as a tags array via insertEvent', async () => {
    const { wrapper, aw } = mountView();
    await flush();
    wrapper.vm.tagsInput = 'a, b';
    wrapper.vm.noteInput = 'note';
    await wrapper.vm.save();
    expect(aw.insertEvent).toHaveBeenCalledTimes(1);
    const [bucket, event] = aw.insertEvent.mock.calls[0];
    expect(bucket).toBe('aw-annotations_box');
    expect(event.data).toEqual({ tags: ['a', 'b'], note: 'note' });
    expect(aw.replaceEvent).not.toHaveBeenCalled();
    expect(wrapper.vm.tagsInput).toBe('');
  });

  test('refuses an empty annotation without touching the server', async () => {
    const { wrapper, aw } = mountView();
    await flush();
    await wrapper.vm.save();
    expect(wrapper.vm.formError).toBe('empty');
    expect(aw.insertEvent).not.toHaveBeenCalled();
  });

  test('editing replaces the event by id and keeps its identity', async () => {
    const { wrapper, aw } = mountView();
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    expect(wrapper.vm.tagsInput).toBe('client-x');
    expect(wrapper.vm.noteInput).toBe('call');
    wrapper.vm.tagsInput = 'client-y';
    await wrapper.vm.save();
    expect(aw.insertEvent).not.toHaveBeenCalled();
    const [, event] = aw.replaceEvent.mock.calls[0];
    expect(event.id).toBe(1);
    expect(event.data.tags).toEqual(['client-y']);
  });

  test.each(['note', 'tags', 'range'])('editing %s preserves untouched event data', async field => {
    const original = {
      ...stored(1, ['a,b', 7], '  original note  '),
      data: { tags: ['a,b', 7], note: '  original note  ', source: 'cli', extra: { v: 1 } },
    };
    const before = JSON.parse(JSON.stringify(original));
    const { wrapper, aw } = mountView([original]);
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    if (field === 'note') wrapper.vm.noteInput = ' updated ';
    if (field === 'tags') wrapper.vm.tagsInput = 'new, tags';
    if (field === 'range') {
      wrapper.vm.endInput = moment(wrapper.vm.endInput)
        .add(1, 'minute')
        .format('YYYY-MM-DDTHH:mm:ss');
    }
    await wrapper.vm.save();
    expect(aw.replaceEvent).toHaveBeenCalledTimes(1);
    expect(aw.replaceEvent.mock.calls[0][1].data).toEqual({
      ...before.data,
      ...(field === 'note' ? { note: 'updated' } : {}),
      ...(field === 'tags' ? { tags: ['new', 'tags'] } : {}),
    });
    expect(original).toEqual(before);
  });

  test('explicitly clearing fields removes the note and tags but preserves metadata', async () => {
    const original = {
      ...stored(1, ['a'], 'note'),
      data: { tags: ['a'], note: 'note', source: 'cli' },
    };
    const { wrapper, aw } = mountView([original]);
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    wrapper.vm.noteInput = '';
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data).toEqual({ tags: ['a'], source: 'cli' });
    wrapper.vm.edit(wrapper.vm.events[0]);
    wrapper.vm.tagsInput = '';
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[1][1].data).toEqual({
      tags: [],
      note: 'note',
      source: 'cli',
    });
    wrapper.vm.tagsInput = 'fresh';
    await wrapper.vm.save();
    expect(aw.insertEvent.mock.calls[0][1].data).toEqual({ tags: ['fresh'] });
  });

  test('deletes by id and reloads', async () => {
    const { wrapper, aw } = mountView();
    await flush();
    await wrapper.vm.remove(wrapper.vm.events[0]);
    expect(aw.deleteEvent).toHaveBeenCalledWith('aw-annotations_box', 1);
    expect(aw.getEvents).toHaveBeenCalledTimes(2);
  });

  test('offers more history when the server returned the sentinel event', async () => {
    const many = Array.from({ length: 101 }, (_, i) => stored(101 - i, ['t']));
    const { wrapper, aw } = mountView(many);
    await flush();
    expect(wrapper.vm.events).toHaveLength(100);
    expect(wrapper.vm.hasMore).toBe(true);
    expect(wrapper.vm.events.map(e => e.id)).toEqual(many.slice(0, 100).map(e => e.id));
    await wrapper.vm.showMore();
    expect(aw.getEvents).toHaveBeenLastCalledWith('aw-annotations_box', { limit: 201 });
    expect(wrapper.vm.events.map(e => e.id)).toEqual(many.map(e => e.id));
    expect(wrapper.vm.hasMore).toBe(false);
  });

  test.each(['getInfo', 'ensureBucket'])('Refresh retries failed %s setup', async method => {
    const failure = jest.fn().mockRejectedValueOnce(new Error('offline'));
    failure.mockResolvedValue(method === 'getInfo' ? { hostname: 'box' } : undefined);
    const { wrapper, aw } = mountView([], { [method]: failure });
    await flush();
    expect(wrapper.vm.error).toBeTruthy();
    expect(aw.getEvents).not.toHaveBeenCalled();
    await wrapper.vm.load();
    expect(failure).toHaveBeenCalledTimes(2);
    expect(aw.getEvents).toHaveBeenCalledWith('aw-annotations_box', { limit: 101 });
    expect(wrapper.vm.error).toBeNull();
  });

  test('tag-only edits preserve exact timestamps and sub-minute durations', async () => {
    const original = {
      ...stored(1, ['a']),
      timestamp: '2026-01-01T10:00:30.123Z',
      duration: 15.456,
    };
    const { wrapper, aw } = mountView([original]);
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    wrapper.vm.tagsInput = 'changed';
    await wrapper.vm.save();
    expect(aw.replaceEvent).toHaveBeenCalledTimes(1);
    const event = aw.replaceEvent.mock.calls[0][1];
    expect(event.timestamp.toISOString()).toBe(original.timestamp);
    expect(event.duration).toBe(original.duration);
  });

  test('pending mutations lock the draft and reject repeated submissions', async () => {
    let finish;
    const request = new Promise(resolve => {
      finish = resolve;
    });
    const { wrapper, aw } = mountView([stored(1, ['a']), stored(2, ['b'])]);
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    aw.replaceEvent.mockReturnValueOnce(request);
    const saving = wrapper.vm.save();
    await wrapper.vm.save();
    wrapper.vm.edit(wrapper.vm.events[1]);
    await wrapper.vm.remove(wrapper.vm.events[1]);
    expect(aw.replaceEvent).toHaveBeenCalledTimes(1);
    expect(aw.deleteEvent).not.toHaveBeenCalled();
    expect(wrapper.vm.editingId).toBe(1);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('#annotation-tags').attributes('disabled')).toBeDefined();
    const edit = wrapper
      .findAll('b-button-stub')
      .wrappers.find(w => w.text() === 'annotations.edit');
    expect(edit.attributes('disabled')).toBeDefined();
    finish();
    await saving;
    expect(wrapper.vm.saving).toBe(false);
  });

  test('duplicate inserts and edits during deletion cannot change the draft', async () => {
    let finish;
    const request = new Promise(resolve => {
      finish = resolve;
    });
    const { wrapper, aw } = mountView();
    await flush();
    wrapper.vm.tagsInput = 'a';
    aw.insertEvent.mockReturnValueOnce(request);
    const saving = wrapper.vm.save();
    await wrapper.vm.save();
    expect(aw.insertEvent).toHaveBeenCalledTimes(1);
    finish();
    await saving;
    const deleting = wrapper.vm.remove(wrapper.vm.events[0]);
    wrapper.vm.edit(wrapper.vm.events[0]);
    expect(wrapper.vm.editingId).toBeNull();
    await deleting;
  });

  test('multi-day ranges show their end date', async () => {
    const original = { ...stored(1, ['a']), duration: 25 * 3600 };
    const { wrapper } = mountView([original]);
    await flush();
    expect(wrapper.find('.annotation-entry').text()).toContain('2026-01-02');
  });
});

// Node reads TZ at startup; replay these component tests in a real DST zone.
if (!process.env.AW_ANNOTATION_ZONE) {
  // eslint-disable-next-line jest/expect-expect
  test('annotation regressions replay in Europe/Stockholm', () => {
    execFileSync(
      process.execPath,
      [
        require.resolve('jest/bin/jest'),
        '--runInBand',
        '--coverage=false',
        '--runTestsByPath',
        __filename,
      ],
      {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, TZ: 'Europe/Stockholm', AW_ANNOTATION_ZONE: '1' },
        stdio: 'pipe',
        timeout: 90000,
      }
    );
  }, 95000);
}

const describeDST = process.env.AW_ANNOTATION_ZONE ? describe : describe.skip;
describeDST('annotation DST handling', () => {
  test('note-only edits retain both occurrences and milliseconds of a repeated hour', async () => {
    const original = {
      ...stored(1, ['a']),
      timestamp: '2026-10-25T00:15:30.123Z',
      duration: 4500.456,
    };
    const { wrapper, aw } = mountView([original]);
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    wrapper.vm.noteInput = 'updated';
    await wrapper.vm.save();
    expect(aw.replaceEvent).toHaveBeenCalledTimes(1);
    const event = aw.replaceEvent.mock.calls[0][1];
    expect(event.timestamp.toISOString()).toBe(original.timestamp);
    expect(event.duration).toBe(original.duration);
  });

  test('changed repeated times require an explicit occurrence and stale choices reset', async () => {
    const { wrapper, aw } = mountView();
    await flush();
    wrapper.vm.tagsInput = 'a';
    wrapper.vm.startInput = '2026-10-25T02:30:00';
    wrapper.vm.endInput = '2026-10-25T03:30:00';
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    expect(aw.insertEvent).not.toHaveBeenCalled();
    expect(wrapper.vm.formError).toBe('unresolvableTime');
    const select = wrapper.find('b-form-select-stub');
    expect(select.exists()).toBe(true);
    expect(select.props('options').map(o => o.text)).toEqual([
      'activity.intervalAmbiguousTime',
      '02:30:00 +02:00',
      '02:30:00 +01:00',
    ]);
    wrapper.vm.startPick = wrapper.vm.startCandidates[1];
    wrapper.vm.startInput = '2026-10-25T02:45:00';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.startPick).toBeNull();
    await wrapper.vm.save();
    expect(aw.insertEvent).not.toHaveBeenCalled();
    wrapper.vm.startPick = wrapper.vm.startCandidates[1];
    await wrapper.vm.save();
    expect(aw.insertEvent).toHaveBeenCalledTimes(1);
    expect(aw.insertEvent.mock.calls[0][1].timestamp.toISOString()).toBe(
      '2026-10-25T01:45:00.000Z'
    );
  });

  test('spring-forward gaps are rejected rather than silently normalized', async () => {
    const { wrapper, aw } = mountView();
    await flush();
    wrapper.vm.tagsInput = 'a';
    wrapper.vm.startInput = '2026-03-29T02:30:00';
    wrapper.vm.endInput = '2026-03-29T03:30:00';
    await wrapper.vm.save();
    expect(aw.insertEvent).not.toHaveBeenCalled();
    expect(wrapper.vm.formError).toBe('unresolvableTime');
  });
});
