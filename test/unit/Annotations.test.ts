import { execFileSync } from 'child_process';
import path from 'path';
import moment from 'moment';
import { createLocalVue, mount, shallowMount, Wrapper } from '@vue/test-utils';
import { BootstrapVue } from 'bootstrap-vue';
import Annotations from '~/views/Annotations.vue';
import {
  annotationBucketId,
  applyTagEdits,
  draftToEvent,
  tagChips,
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
  test('tagChips trims and de-duplicates without splitting stored names', () => {
    expect(tagChips([' a,b ', '', 'c', 'c', 7])).toEqual(['a,b', 'c']);
    expect(tagChips('x, y')).toEqual(['x', 'y']);
    expect(tagChips({ name: 'x' })).toEqual([]);
    expect(tagChips(undefined)).toEqual([]);
  });

  test('applyTagEdits only changes the names the user added or removed', () => {
    expect(applyTagEdits(['a,b', 7, ' c '], ['a,b', 'c', 'new'])).toEqual(['a,b', 7, ' c ', 'new']);
    expect(applyTagEdits(['a,b', 7, 'c'], ['c'])).toEqual([7, 'c']);
    expect(applyTagEdits('x, y', ['y', 'z'])).toEqual(['y', 'z']);
    expect(applyTagEdits(undefined, ['z'])).toEqual(['z']);
  });

  test('bucket id is per host', () => {
    expect(annotationBucketId('box')).toBe('aw-annotations_box');
  });

  test('validateDraft rejects bad ranges and empty annotations', () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const end = new Date('2026-01-01T11:00:00Z');
    expect(validateDraft({ start, end, tags: ['a'], note: '' })).toBeNull();
    expect(validateDraft({ start, end, tags: [], note: ' hi ' })).toBeNull();
    expect(validateDraft({ start, end, tags: [' ', ''], note: '  ' })).toBe('empty');
    expect(validateDraft({ start: end, end: start, tags: ['a'], note: '' })).toBe('invalidRange');
    expect(validateDraft({ start, end: start, tags: ['a'], note: '' })).toBe('invalidRange');
    expect(validateDraft({ start: new Date('x'), end, tags: ['a'], note: '' })).toBe(
      'invalidRange'
    );
  });

  test('draftToEvent stores tags as an array and omits a blank note', () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const end = new Date('2026-01-01T10:30:00Z');
    expect(draftToEvent({ start, end, tags: ['a', 'b'], note: '  ' })).toEqual({
      timestamp: start,
      duration: 1800,
      data: { tags: ['a', 'b'] },
    });
    expect(draftToEvent({ start, end, tags: [], note: ' hi ' }).data).toEqual({
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
    wrapper.vm.tags = ['a', 'b'];
    wrapper.vm.noteInput = 'note';
    await wrapper.vm.save();
    expect(aw.insertEvent).toHaveBeenCalledTimes(1);
    const [bucket, event] = aw.insertEvent.mock.calls[0];
    expect(bucket).toBe('aw-annotations_box');
    expect(event.data).toEqual({ tags: ['a', 'b'], note: 'note' });
    expect(aw.replaceEvent).not.toHaveBeenCalled();
    expect(wrapper.vm.tags).toEqual([]);
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
    expect(wrapper.vm.tags).toEqual(['client-x']);
    expect(wrapper.vm.noteInput).toBe('call');
    wrapper.vm.tags = ['client-y'];
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
    if (field === 'tags') wrapper.vm.tags = [...wrapper.vm.tags, 'new'];
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
      ...(field === 'tags' ? { tags: ['a,b', 7, 'new'] } : {}),
    });
    expect(original).toEqual(before);
  });

  test.each([42, { text: 'external note' }, false, null])(
    'editing preserves a non-string note (%p) unless replaced explicitly',
    async note => {
      const original = {
        ...stored(1, ['a']),
        data: { tags: ['a'], note, source: 'cli' },
      };
      const before = JSON.parse(JSON.stringify(original));
      const { wrapper, aw } = mountView([original]);
      await flush();
      wrapper.vm.edit(wrapper.vm.events[0]);
      wrapper.vm.tags = ['changed'];
      await expect(wrapper.vm.save()).resolves.toBeUndefined();
      expect(aw.replaceEvent).toHaveBeenCalledTimes(1);
      expect(aw.replaceEvent.mock.calls[0][1].data).toEqual({
        ...before.data,
        tags: ['changed'],
      });

      wrapper.vm.edit(wrapper.vm.events[0]);
      wrapper.vm.endInput = moment(original.timestamp).add(1, 'hour').format('YYYY-MM-DDTHH:mm:ss');
      await wrapper.vm.save();
      expect(aw.replaceEvent.mock.calls[1][1].data).toEqual(before.data);
      expect(aw.replaceEvent.mock.calls[1][1].duration).toBe(3600);

      wrapper.vm.edit(wrapper.vm.events[0]);
      wrapper.vm.noteInput = ' new note ';
      await wrapper.vm.save();
      expect(aw.replaceEvent.mock.calls[2][1].data).toEqual({
        ...before.data,
        note: 'new note',
      });
      expect(original).toEqual(before);
    }
  );

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
    wrapper.vm.tags = [];
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[1][1].data).toEqual({
      tags: [],
      note: 'note',
      source: 'cli',
    });
    wrapper.vm.tags = ['fresh'];
    await wrapper.vm.save();
    expect(aw.insertEvent.mock.calls[0][1].data).toEqual({ tags: ['fresh'] });
  });

  test('range-only edits save when the stored tags are not form-representable', async () => {
    // The editor cannot show [7] (not a string) or a numeric note, so the
    // form shows no tags and no note. A time-only edit must still be allowed:
    // the merge below keeps the original values untouched.
    const original = { ...stored(1, ['a']), data: { tags: [7], note: 5 } };
    const { wrapper, aw } = mountView([original]);
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    expect(wrapper.vm.tags).toEqual([]);
    expect(wrapper.vm.noteInput).toBe('');
    wrapper.vm.endInput = moment(original.timestamp).add(1, 'hour').format('YYYY-MM-DDTHH:mm:ss');
    await wrapper.vm.save();
    expect(wrapper.vm.formError).toBeNull();
    expect(aw.replaceEvent).toHaveBeenCalledTimes(1);
    expect(aw.replaceEvent.mock.calls[0][1].data).toEqual({ tags: [7], note: 5 });
    expect(aw.replaceEvent.mock.calls[0][1].duration).toBe(3600);
  });

  test('clearing a note the form cannot represent removes it', async () => {
    // A numeric note renders blank, so "blank" is both what an untouched note
    // and a cleared note look like. Editing the textarea is the only signal the
    // user can give, and it must drop the stored value rather than write it
    // back invisibly on every save.
    const original = { ...stored(1, ['a']), data: { tags: ['a'], note: 5 } };
    const { wrapper, aw } = mountView([original]);
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    expect(wrapper.vm.noteInput).toBe('');
    wrapper.find('#annotation-note').vm.$emit('input', '');
    await flush();
    await wrapper.vm.save();
    expect(wrapper.vm.formError).toBeNull();
    expect(aw.replaceEvent).toHaveBeenCalledTimes(1);
    expect(aw.replaceEvent.mock.calls[0][1].data).toEqual({ tags: ['a'] });
  });

  test.each([
    ['numeric note without tags', { tags: [], note: 5 }],
    ['string tags without a note', { tags: 'x,y' }],
  ])('range-only edits count unrepresentable data as content: %s', async (_name, data) => {
    const original = { ...stored(1, ['a']), data };
    const { wrapper, aw } = mountView([original]);
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    wrapper.vm.endInput = moment(original.timestamp).add(1, 'hour').format('YYYY-MM-DDTHH:mm:ss');
    await wrapper.vm.save();
    expect(wrapper.vm.formError).toBeNull();
    expect(aw.replaceEvent).toHaveBeenCalledTimes(1);
    expect(aw.replaceEvent.mock.calls[0][1].data).toEqual(data);
  });

  test('the tag editor keeps stored names whole and untouched tags verbatim', async () => {
    const original = { ...stored(1, ['a']), data: { tags: [' a,b ', 7, 'c', 'c'] } };
    const aw = mountView([original]).aw;
    // A real BootstrapVue tag input: it normalises its model, which must not
    // count as an edit.
    const wrapper: Wrapper<any> = mount(Annotations, {
      localVue,
      mocks: { $aw: aw, $t: (k: string) => k },
      stubs: { icon: true },
    });
    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    await wrapper.vm.$nextTick();
    wrapper.vm.noteInput = 'note';
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual(original.data.tags);

    await flush();
    wrapper.vm.edit(wrapper.vm.events[0]);
    await wrapper.vm.$nextTick();
    const input = wrapper.find('#annotation-tags');
    await input.setValue('new');
    await input.trigger('change');
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[1][1].data.tags).toEqual([' a,b ', 7, 'c', 'c', 'new']);
  });

  test.each(['resolves', 'rejects'])(
    'an older read that %s last cannot replace newer events',
    async outcome => {
      const { wrapper, aw } = mountView([stored(1, ['a'])]);
      await flush();
      let finish;
      aw.getEvents.mockReturnValueOnce(
        new Promise((resolve, reject) => {
          finish = () =>
            outcome === 'resolves' ? resolve([stored(1, ['a'])]) : reject(new Error('late'));
        })
      );
      const older = wrapper.vm.showMore();
      aw.getEvents.mockResolvedValueOnce([]);
      await wrapper.vm.load();
      finish();
      await older;
      expect(wrapper.vm.events).toEqual([]);
      expect(wrapper.vm.error).toBeNull();
      expect(wrapper.vm.loading).toBe(false);
    }
  );

  test('paging is disabled while a write is pending', async () => {
    const many = Array.from({ length: 101 }, (_, i) => stored(101 - i, ['t']));
    const { wrapper, aw } = mountView(many);
    await flush();
    let finish;
    aw.deleteEvent.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    const showMore = () =>
      wrapper.findAll('b-button-stub').wrappers.find(w => w.text() === 'annotations.showMore');
    const deleting = wrapper.vm.remove(wrapper.vm.events[0]);
    await wrapper.vm.$nextTick();
    expect(showMore().attributes('disabled')).toBeDefined();
    finish();
    await deleting;
    await wrapper.vm.$nextTick();
    expect(showMore().attributes('disabled')).toBeUndefined();
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
    // A failed read must not also claim that nothing is saved.
    expect(wrapper.text()).not.toContain('annotations.empty');
    await wrapper.vm.load();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('annotations.empty');
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
    wrapper.vm.tags = ['changed'];
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
    expect(wrapper.find('b-form-tags-stub').attributes('disabled')).toBeDefined();
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
    wrapper.vm.tags = ['a'];
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

  test('the list renders notes through formatNote instead of raw values', async () => {
    const { wrapper } = mountView([
      stored(1, ['a'], 'plain note'),
      stored(2, ['a'], { text: 'external note' }),
    ]);
    await flush();
    const notes = wrapper.findAll('.annotation-note');
    // A string note renders as-is; a structured note is not JSON-stringified
    // into the UI (the editor already shows such values as blank).
    expect(notes).toHaveLength(1);
    expect(notes.at(0).text()).toBe('plain note');
    expect(wrapper.text()).not.toContain('external note');
    expect(wrapper.text()).not.toContain('"text"');
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
    wrapper.vm.tags = ['a'];
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
    wrapper.vm.tags = ['a'];
    wrapper.vm.startInput = '2026-03-29T02:30:00';
    wrapper.vm.endInput = '2026-03-29T03:30:00';
    await wrapper.vm.save();
    expect(aw.insertEvent).not.toHaveBeenCalled();
    expect(wrapper.vm.formError).toBe('unresolvableTime');
  });
});
