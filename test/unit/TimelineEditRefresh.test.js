import moment from 'moment';
import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import EventEditor from '~/components/EventEditor.vue';
import VisTimeline from '~/visualizations/VisTimeline.vue';
import Timeline from '~/views/Timeline.vue';
import { reloadEditedBucket } from '~/util/timelineBucketRefresh';
import { useBucketsStore } from '~/stores/buckets';

jest.mock('~/stores/buckets', () => ({ useBucketsStore: jest.fn() }));
jest.mock('vis-timeline/esnext', () => ({ Timeline: jest.fn() }));
jest.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

const range = [moment('2026-09-24T00:00:00Z'), moment('2026-09-25T00:00:00Z')];
const bucket = (id, app) => ({ id, events: [{ id: 1, data: { app } }] });
const visStub = {
  name: 'vis-timeline',
  props: ['buckets', 'updateTimelineWindow', 'queriedInterval'],
  render: h => h('div'),
};

function mountView(...buckets) {
  setActivePinia(createPinia());
  return shallowMount(Timeline, {
    data: () => ({ daterange: range, all_buckets: buckets, buckets }),
    mocks: { $t: key => key, $bvToast: { toast: jest.fn() } },
    stubs: {
      'vis-timeline': visStub,
      'input-timeinterval': true,
      'b-dropdown': true,
      'b-dropdown-header': true,
      'b-dropdown-item-button': true,
      'b-form-checkbox': true,
      'aw-devonly': true,
      'aw-calendar': true,
      icon: true,
    },
  });
}

test('notifies the timeline only after the save succeeds', async () => {
  let finishSave;
  const request = new Promise(resolve => (finishSave = resolve));
  const emitted = [];
  const editor = {
    bucket_id: 'edited',
    editedEvent: { id: 1 },
    $aw: { replaceEvent: jest.fn(() => request) },
    $emit: (name, value) => emitted.push([name, value]),
  };

  const saving = EventEditor.methods.save.call(editor);
  expect(emitted).toEqual([['save', { id: 1 }]]);
  editor.bucket_id = 'other';
  editor.editedEvent = { id: 2 };
  finishSave();
  await saving;
  expect(editor.$aw.replaceEvent).toHaveBeenCalledWith('edited', { id: 1 });
  expect(emitted[1]).toEqual(['saved', 'edited']);

  const timeline = { editingEventBucket: 'other', $emit: jest.fn() };
  VisTimeline.methods.onEventSaved.call(timeline, emitted[1][1]);
  expect(timeline.$emit).toHaveBeenCalledWith('event-saved', 'edited');

  editor.$aw.replaceEvent.mockRejectedValueOnce(new Error('save failed'));
  await expect(EventEditor.methods.save.call(editor)).rejects.toThrow('save failed');
  expect(emitted.map(([name]) => name)).toEqual(['save', 'saved', 'save']);
});

test('removes the edited row when it no longer matches the filter', async () => {
  const allBuckets = [bucket('edited', 'Original App'), bucket('other', 'Other App')];
  useBucketsStore.mockReturnValue({
    getBucketWithEvents: jest.fn().mockResolvedValue(bucket('edited', 'Edited App')),
  });

  const result = await reloadEditedBucket(allBuckets, allBuckets, 'edited', range, () => []);

  expect(result.displayedBuckets.map(b => b.id)).toEqual(['other']);
  expect(result.allBuckets.map(b => b.id)).toEqual(['edited', 'other']);
});

test('a saved edit reaches the timeline view', async () => {
  const original = bucket('edited', 'Original App');
  const other = bucket('other', 'Other App');
  const getBucketWithEvents = jest.fn().mockResolvedValue(bucket('edited', 'Edited App'));
  useBucketsStore.mockReturnValue({ getBucketWithEvents });
  const wrapper = mountView(original, other);
  const vis = wrapper.findComponent(visStub);

  vis.vm.$emit('event-saved', 'edited');
  await new Promise(resolve => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();

  expect(getBucketWithEvents).toHaveBeenCalledTimes(1);
  expect(getBucketWithEvents).toHaveBeenCalledWith({
    id: 'edited',
    start: range[0].format(),
    end: range[1].format(),
  });
  expect(vis.props('buckets').map(b => b.events[0].data.app)).toEqual(['Edited App', 'Other App']);
  wrapper.destroy();
});

test('a saved edit supersedes an older full load', async () => {
  let finishOldLoad;
  const oldLoad = new Promise(resolve => (finishOldLoad = resolve));
  const getBucketsWithEvents = jest
    .fn()
    .mockReturnValueOnce(oldLoad)
    .mockResolvedValueOnce([bucket('edited', 'Edited App')]);
  useBucketsStore.mockReturnValue({ getBucketsWithEvents });
  const wrapper = mountView(bucket('edited', 'Original App'));
  const pendingLoad = wrapper.vm.getBuckets();

  await wrapper.vm.refreshAfterEdit('edited');
  finishOldLoad([bucket('edited', 'Original App')]);
  await pendingLoad;
  await wrapper.vm.$nextTick();

  expect(getBucketsWithEvents).toHaveBeenCalledTimes(2);
  expect(wrapper.findComponent(visStub).props('buckets')[0].events[0].data.app).toBe('Edited App');
  wrapper.destroy();
});

test('a failed reread leaves the timeline visible and warns', async () => {
  const original = bucket('edited', 'Original App');
  useBucketsStore.mockReturnValue({
    getBucketWithEvents: jest.fn().mockRejectedValue(new Error('offline')),
  });
  const wrapper = mountView(original);
  const log = jest.spyOn(console, 'error').mockImplementation(jest.fn());
  try {
    await wrapper.vm.refreshAfterEdit('edited');
    expect(wrapper.findComponent(visStub).props('buckets')).toEqual([original]);
    expect(wrapper.vm.$bvToast.toast).toHaveBeenCalledWith(
      expect.stringContaining('Event saved'),
      expect.objectContaining({ variant: 'warning' })
    );
  } finally {
    log.mockRestore();
    wrapper.destroy();
  }
});

test('overlapping saves in different buckets retain both edits', async () => {
  let finishFirstRefresh;
  const firstRefresh = new Promise(resolve => (finishFirstRefresh = resolve));
  const edited = bucket('edited', 'Edited App');
  const other = bucket('other', 'Edited Other App');
  useBucketsStore.mockReturnValue({
    getBucketWithEvents: jest.fn().mockReturnValueOnce(firstRefresh).mockResolvedValue(other),
    getBucketsWithEvents: jest.fn().mockResolvedValue([edited, other]),
  });
  const wrapper = mountView(bucket('edited', 'Original App'), bucket('other', 'Other App'));
  try {
    const pendingRefresh = wrapper.vm.refreshAfterEdit('edited');
    await wrapper.vm.refreshAfterEdit('other');
    finishFirstRefresh(edited);
    await pendingRefresh;
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent(visStub).props('buckets')).toEqual([edited, other]);
    expect(wrapper.findComponent(visStub).props('updateTimelineWindow')).toBe(false);
  } finally {
    wrapper.destroy();
  }
});

test('a save during date navigation preserves the new timeline window', async () => {
  let finishOldLoad;
  const oldLoad = new Promise(resolve => (finishOldLoad = resolve));
  const edited = bucket('edited', 'Edited App');
  const getBucketsWithEvents = jest
    .fn()
    .mockReturnValueOnce(oldLoad)
    .mockResolvedValueOnce([edited]);
  useBucketsStore.mockReturnValue({ getBucketsWithEvents });
  const wrapper = mountView(bucket('edited', 'Original App'));
  const nextRange = range.map(value => value.clone().add(1, 'day'));
  try {
    await wrapper.setData({ daterange: nextRange });
    expect(getBucketsWithEvents).toHaveBeenCalledTimes(1);
    await wrapper.vm.refreshAfterEdit('edited');
    finishOldLoad([bucket('edited', 'Original App')]);
    await new Promise(resolve => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    const vis = wrapper.findComponent(visStub);
    expect(vis.props('buckets')).toEqual([edited]);
    expect(vis.props('queriedInterval')).toEqual(nextRange);
    expect(vis.props('updateTimelineWindow')).toBe(true);
    expect(getBucketsWithEvents).toHaveBeenLastCalledWith({
      start: nextRange[0].format(),
      end: nextRange[1].format(),
    });
  } finally {
    wrapper.destroy();
  }
});
