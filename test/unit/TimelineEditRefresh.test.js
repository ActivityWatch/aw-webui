import moment from 'moment';
import EventEditor from '~/components/EventEditor.vue';
import VisTimeline from '~/visualizations/VisTimeline.vue';
import { reloadEditedBucket } from '~/util/timelineBucketRefresh';
import { useBucketsStore } from '~/stores/buckets';

jest.mock('~/stores/buckets', () => ({ useBucketsStore: jest.fn() }));
jest.mock('vis-timeline/esnext', () => ({ Timeline: jest.fn() }));
jest.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

const range = [moment('2026-09-24T00:00:00Z'), moment('2026-09-25T00:00:00Z')];
const bucket = (id, app) => ({ id, events: [{ id: 1, data: { app } }] });

test('notifies the timeline only after the save succeeds', async () => {
  let finishSave;
  const request = new Promise(resolve => (finishSave = resolve));
  const emitted = [];
  const editor = {
    bucket_id: 'edited',
    editedEvent: { id: 1 },
    $aw: { replaceEvent: jest.fn(() => request) },
    $emit: name => emitted.push(name),
  };

  const saving = EventEditor.methods.save.call(editor);
  expect(emitted).toEqual(['save']);
  finishSave();
  await saving;
  expect(emitted).toEqual(['save', 'saved']);

  const timeline = { editingEventBucket: 'edited', $emit: jest.fn() };
  VisTimeline.methods.onEventSaved.call(timeline);
  expect(timeline.$emit).toHaveBeenCalledWith('event-saved', 'edited');

  editor.$aw.replaceEvent.mockRejectedValueOnce(new Error('save failed'));
  await expect(EventEditor.methods.save.call(editor)).rejects.toThrow('save failed');
  expect(emitted).toEqual(['save', 'saved', 'save']);
});

test('rereads only the edited bucket and keeps the other row', async () => {
  const other = bucket('other', 'Other App');
  const allBuckets = [bucket('edited', 'Original App'), other];
  const getBucketWithEvents = jest.fn().mockResolvedValue(bucket('edited', 'Edited App'));
  useBucketsStore.mockReturnValue({ getBucketWithEvents });

  const result = await reloadEditedBucket(allBuckets, allBuckets, 'edited', range, b => b);

  expect(getBucketWithEvents).toHaveBeenCalledTimes(1);
  expect(getBucketWithEvents).toHaveBeenCalledWith({
    id: 'edited',
    start: range[0].format(),
    end: range[1].format(),
  });
  expect(result.displayedBuckets[0].events[0].data.app).toBe('Edited App');
  expect(result.displayedBuckets[1]).toBe(other);
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
