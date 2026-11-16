import { createLocalVue, shallowMount } from '@vue/test-utils';
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

function mountView(events = [stored(1, ['client-x'], 'call')]) {
  const aw = {
    getInfo: jest.fn().mockResolvedValue({ hostname: 'box' }),
    ensureBucket: jest.fn().mockResolvedValue(undefined),
    getEvents: jest.fn().mockResolvedValue(events),
    insertEvent: jest.fn().mockResolvedValue(undefined),
    replaceEvent: jest.fn().mockResolvedValue(undefined),
    deleteEvent: jest.fn().mockResolvedValue(undefined),
  };
  const wrapper = shallowMount(Annotations, {
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

  test('deletes by id and reloads', async () => {
    const { wrapper, aw } = mountView();
    await flush();
    await wrapper.vm.remove(wrapper.vm.events[0]);
    expect(aw.deleteEvent).toHaveBeenCalledWith('aw-annotations_box', 1);
    expect(aw.getEvents).toHaveBeenCalledTimes(2);
  });

  test('offers more history when the server returned the sentinel event', async () => {
    const many = Array.from({ length: 101 }, (_, i) => stored(i + 1, ['t']));
    const { wrapper } = mountView(many);
    await flush();
    expect(wrapper.vm.events).toHaveLength(100);
    expect(wrapper.vm.hasMore).toBe(true);
  });
});
