import { createLocalVue, mount, shallowMount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import moment from 'moment';
import Stopwatch from '~/views/Stopwatch.vue';
import StopwatchEntry from '~/components/StopwatchEntry.vue';
import EventEditor from '~/components/EventEditor.vue';

const localVue = createLocalVue();
localVue.use(BootstrapVue);
localVue.filter('friendlyduration', String);
localVue.filter('friendlytime', String);
localVue.filter('shorttime', String);
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const timer = (tags?: string[]) => ({
  id: 1,
  timestamp: new Date('2026-10-20T12:00:00Z'),
  duration: 60,
  data: { label: 'Study', running: false, ...(tags ? { tags } : {}) },
});

function stopwatch(pastEvents = []) {
  const aw = {
    ensureBucket: jest.fn().mockResolvedValue(undefined),
    heartbeat: jest.fn().mockResolvedValue(undefined),
    req: { post: jest.fn().mockResolvedValue({ data: [{ running: [], history: pastEvents }] }) },
  };
  const wrapper: any = shallowMount(Stopwatch, {
    localVue,
    mocks: { $aw: aw },
    stubs: { icon: true },
  });
  return { wrapper, aw };
}

describe('Stopwatch event tags', () => {
  beforeEach(() => jest.spyOn(global, 'setInterval').mockImplementation(() => 1 as any));
  afterEach(() => jest.restoreAllMocks());

  test('parses comma-separated form input into an array before sending a heartbeat', async () => {
    const { wrapper, aw } = stopwatch();
    await flush();
    const tags = wrapper.find('[data-testid="stopwatch-tags"]');
    expect(tags.exists()).toBe(true);
    await wrapper.setData({ tags: ' study,  deep work, ,reading , ' });
    await wrapper.vm.$nextTick();
    await wrapper.vm.startTimer('Study');
    expect(aw.heartbeat.mock.calls[0][2].data).toEqual({
      label: 'Study',
      running: true,
      tags: ['study', 'deep work', 'reading'],
    });
    wrapper.destroy();
  });

  test.each<[string[] | undefined]>([[undefined], [['work', 'meeting']]])(
    'Start New inherits tags without mutating history: %p',
    async tags => {
      const past = timer(tags);
      const original = JSON.stringify(past);
      const { wrapper, aw } = stopwatch([past]);
      await flush();
      // A separate draft must not leak into a restarted historical timer.
      await wrapper.setData({ tags: 'unrelated draft' });
      wrapper.findComponent(StopwatchEntry).vm.$emit('new');
      await flush();
      expect(aw.heartbeat.mock.calls[0][2].data).toEqual({
        label: 'Study',
        running: true,
        tags: tags || [],
      });
      expect(JSON.stringify(past)).toBe(original);
      if (tags) expect(aw.heartbeat.mock.calls[0][2].data.tags).not.toBe(tags);
      wrapper.destroy();
    }
  );

  test('shows tags and enables their editor, while Stop preserves their array', async () => {
    const past = {
      ...timer(['work', 'meeting']),
      data: { ...timer(['work', 'meeting']).data, running: true },
    };
    const aw = { replaceEvent: jest.fn().mockResolvedValue(undefined) };
    const wrapper: any = shallowMount(StopwatchEntry, {
      localVue,
      propsData: { event: past, bucket_id: 'aw-stopwatch', now: moment() },
      mocks: { $aw: aw },
      stubs: { icon: true },
    });
    expect(wrapper.text()).toContain('work, meeting');
    expect(wrapper.findComponent(EventEditor).props('editableTags')).toBe(true);
    await wrapper.vm.stop();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual(['work', 'meeting']);
    expect(past.data.running).toBe(true);
    wrapper.destroy();
  });
});

function editor(event, editableTags = true) {
  const aw = {
    getEvent: jest.fn().mockResolvedValue(JSON.parse(JSON.stringify(event))),
    replaceEvent: jest.fn().mockResolvedValue(undefined),
  };
  const wrapper: any = mount(EventEditor, {
    localVue,
    propsData: { event, bucket_id: 'aw-stopwatch', editableTags },
    mocks: { $aw: aw },
    stubs: { icon: true, datetime: true },
    attachTo: document.body,
  });
  return { wrapper, aw };
}

async function openEditor(wrapper) {
  await flush();
  wrapper.vm.$refs.eventEditModal.show();
  await flush();
  await wrapper.vm.$nextTick();
}

describe('Stopwatch tags editor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test.each<[string[] | undefined]>([[undefined], [['old']]])(
    'adds or edits tags before persistence, not after the saved notification: %p',
    async tags => {
      const past = timer(tags);
      const original = JSON.stringify(past);
      const { wrapper, aw } = editor(past);
      await openEditor(wrapper);
      const input = document.querySelector('[data-testid="event-tags"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      input.value = ' work, deep focus, , reading ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wrapper.vm.$nextTick();
      await wrapper.vm.save();
      const saved = aw.replaceEvent.mock.calls[0][1];
      expect(saved.data.tags).toEqual(['work', 'deep focus', 'reading']);
      expect(wrapper.emitted('saved')[0][0].data.tags).toEqual(saved.data.tags);
      expect(saved.timestamp).toBe(past.timestamp.toISOString());
      expect(saved.duration).toBe(60);
      expect(JSON.stringify(past)).toBe(original);
      wrapper.destroy();
    }
  );

  test('allows clearing all tags', async () => {
    const { wrapper, aw } = editor(timer(['old']));
    await openEditor(wrapper);
    const input = document.querySelector('[data-testid="event-tags"]') as HTMLInputElement;
    input.value = ' , ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual([]);
    wrapper.destroy();
  });

  test('generic event editing does not add stopwatch tags', async () => {
    const { wrapper, aw } = editor(timer(), false);
    await openEditor(wrapper);
    expect(wrapper.find('[data-testid="event-tags"]').exists()).toBe(false);
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data).not.toHaveProperty('tags');
    wrapper.destroy();
  });
});
