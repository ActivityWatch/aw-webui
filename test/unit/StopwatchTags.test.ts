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
    // Emit from the input component so the v-model/@input wiring is exercised.
    tags.vm.$emit('input', ' study,  deep work, ,reading , ');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await wrapper.vm.startTimer('Study');
    expect(aw.heartbeat.mock.calls[0][2].data).toEqual({
      label: 'Study',
      running: true,
      tags: ['study', 'deep work', 'reading'],
    });
    wrapper.destroy();
  });

  test('offers recent tags (newest first, deduplicated) and toggles them into the input', async () => {
    const older = {
      ...timer(['work', 'deep work']),
      id: 1,
      timestamp: new Date('2026-10-19T12:00:00Z'),
    };
    const newer = {
      ...timer(['meeting', 'work']),
      id: 2,
      timestamp: new Date('2026-10-20T12:00:00Z'),
    };
    const { wrapper } = stopwatch([older, newer]);
    await flush();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.recentTags).toEqual(['meeting', 'work', 'deep work']);
    expect(wrapper.find('[data-testid="stopwatch-recent-tags"]').exists()).toBe(true);

    wrapper.vm.toggleTag('work');
    wrapper.vm.toggleTag('meeting');
    expect(wrapper.vm.selectedTags).toEqual(['work', 'meeting']);
    expect(wrapper.vm.tags).toBe('');
    wrapper.vm.toggleTag('work');
    expect(wrapper.vm.selectedTags).toEqual(['meeting']);
    wrapper.destroy();
  });

  test('a clicked recent tag containing a comma stays one array entry', async () => {
    const past = timer(['research, development', 'work']);
    const { wrapper, aw } = stopwatch([past]);
    await flush();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.recentTags).toContain('research, development');

    wrapper.vm.toggleTag('research, development');
    await wrapper.vm.$nextTick();
    // Selected state survives the text round-trip, so a second click removes it.
    expect(wrapper.vm.selectedTags).toEqual(['research, development']);
    wrapper.vm.toggleTag('research, development');
    expect(wrapper.vm.selectedTags).toEqual([]);

    wrapper.vm.toggleTag('research, development');
    await wrapper.vm.$nextTick();
    await wrapper.vm.startTimer('Study');
    expect(aw.heartbeat.mock.calls[0][2].data.tags).toEqual(['research, development']);
    wrapper.destroy();
  });

  test('typing after selecting a comma-containing tag preserves its boundary', async () => {
    const { wrapper, aw } = stopwatch([timer(['research, development', 'work'])]);
    await flush();
    wrapper.vm.toggleTag('research, development');
    await wrapper.vm.$nextTick();
    // The text field is a separate draft, not a lossy serialization of chips.
    expect(wrapper.vm.tags).toBe('');
    const input = wrapper.find('[data-testid="stopwatch-tags"]');
    input.vm.$emit('input', 'urgent, work');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedTags).toEqual(['research, development', 'urgent', 'work']);
    expect(wrapper.find('.stopwatch-recent-tag').attributes('aria-pressed')).toBe('true');
    // Clearing the draft cannot delete a selected chip, but clicking it can.
    input.vm.$emit('input', '');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedTags).toEqual(['research, development']);
    input.vm.$emit('input', 'urgent, work');
    await wrapper.vm.$nextTick();
    await wrapper.vm.startTimer('Study');
    expect(aw.heartbeat.mock.calls[0][2].data.tags).toEqual([
      'research, development',
      'urgent',
      'work',
    ]);
    wrapper.destroy();
  });

  test('starting a timer clears chip selections and the tag draft', async () => {
    const { wrapper, aw } = stopwatch([timer(['work'])]);
    await flush();
    await wrapper.vm.$nextTick();
    wrapper.vm.toggleTag('work');
    const input = wrapper.find('[data-testid="stopwatch-tags"]');
    input.vm.$emit('input', 'urgent');
    await wrapper.vm.$nextTick();
    await wrapper.vm.startTimer('Study');
    expect(aw.heartbeat.mock.calls[0][2].data.tags).toEqual(['work', 'urgent']);
    // A started timer must not preload the next one with invisible state.
    expect(wrapper.vm.selectedTags).toEqual([]);
    expect(wrapper.vm.tags).toBe('');
    await wrapper.vm.startTimer('Study again');
    expect(aw.heartbeat.mock.calls[1][2].data.tags).toEqual([]);
    wrapper.destroy();
  });

  test('toggling a typed recent tag removes it and selecting it again does not duplicate it', async () => {
    const { wrapper } = stopwatch([timer(['work'])]);
    await flush();
    const input = wrapper.find('[data-testid="stopwatch-tags"]');
    input.vm.$emit('input', 'work, urgent');
    await wrapper.vm.$nextTick();
    wrapper.vm.toggleTag('work');
    expect(wrapper.vm.selectedTags).toEqual(['urgent']);
    expect(wrapper.vm.tags).toBe('urgent');
    wrapper.vm.toggleTag('work');
    input.vm.$emit('input', 'urgent, work');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedTags).toEqual(['work', 'urgent']);
    wrapper.destroy();
  });

  test('suggests chips for legacy comma-separated string tags', async () => {
    const legacy = {
      ...timer(),
      data: { ...timer().data, tags: 'work, meeting' },
    };
    const { wrapper } = stopwatch([legacy]);
    await flush();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.recentTags).toEqual(['work', 'meeting']);
    expect(wrapper.find('[data-testid="stopwatch-recent-tags"]').exists()).toBe(true);
    wrapper.destroy();
  });

  test('recent-tag chips expose their pressed state to assistive tech', async () => {
    const { wrapper } = stopwatch([timer(['work'])]);
    await flush();
    await wrapper.vm.$nextTick();
    const chip = wrapper.find('.stopwatch-recent-tag');
    expect(chip.attributes('aria-pressed')).toBe('false');
    wrapper.vm.toggleTag('work');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.stopwatch-recent-tag').attributes('aria-pressed')).toBe('true');
    wrapper.destroy();
  });

  test('keeps a chip-selected tag visible and removable after its events disappear', async () => {
    const { wrapper, aw } = stopwatch([timer(['work'])]);
    await flush();
    await wrapper.vm.$nextTick();
    wrapper.vm.toggleTag('work');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedTags).toEqual(['work']);

    // The only event supplying the tag is deleted, so it leaves recentTags.
    aw.req.post.mockResolvedValue({ data: [{ running: [], history: [] }] });
    await wrapper.vm.getEvents();
    await flush();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.recentTags).toEqual([]);

    // The selection must not become a hidden tag that Start would still save.
    const chips = wrapper.findAll('.stopwatch-recent-tag');
    expect(chips).toHaveLength(1);
    expect(chips.at(0).text()).toBe('work');
    expect(chips.at(0).attributes('aria-pressed')).toBe('true');
    expect(wrapper.vm.selectedTags).toEqual(['work']);

    wrapper.vm.toggleTag('work');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectedTags).toEqual([]);
    expect(wrapper.find('[data-testid="stopwatch-recent-tags"]').exists()).toBe(false);
    wrapper.destroy();
  });

  test('hides the recent-tag row when no event has tags', async () => {
    const { wrapper } = stopwatch([timer()]);
    await flush();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.recentTags).toEqual([]);
    expect(wrapper.find('[data-testid="stopwatch-recent-tags"]').exists()).toBe(false);
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
      wrapper.vm.onTagsInput('unrelated draft');
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

  test.each([
    { tags: 'work, meeting', expected: ['work', 'meeting'] },
    { tags: { legacy: 'work' }, expected: [] },
    { tags: null, expected: [] },
  ])('Start New handles legacy tags without changing history: %p', async ({ tags, expected }) => {
    const past = { ...timer(), data: { ...timer().data, tags } };
    const original = JSON.stringify(past);
    const { wrapper, aw } = stopwatch([past]);
    await flush();
    wrapper.vm.onTagsInput('unrelated draft');
    wrapper.findComponent(StopwatchEntry).vm.$emit('new');
    await flush();
    expect(aw.heartbeat).toHaveBeenCalledTimes(1);
    expect(aw.heartbeat.mock.calls[0][2].data).toEqual({
      label: 'Study',
      running: true,
      tags: expected,
    });
    expect(JSON.stringify(past)).toBe(original);
    wrapper.destroy();
  });

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
      for (const button of Array.from(document.querySelectorAll('.b-form-tag-remove'))) {
        (button as HTMLButtonElement).click();
      }
      await wrapper.vm.$nextTick();
      input.value = ' work, deep focus, , reading ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
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

  test('adding a tag preserves existing comma-containing tag boundaries', async () => {
    const past = timer(['research, development', 'work']);
    const original = JSON.stringify(past);
    const { wrapper, aw } = editor(past);
    await openEditor(wrapper);
    const input = document.querySelector('[data-testid="event-tags"]') as HTMLInputElement;
    input.value = 'urgent';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual([
      'research, development',
      'work',
      'urgent',
    ]);
    expect(JSON.stringify(past)).toBe(original);
    wrapper.destroy();
  });

  test('removing another tag preserves comma-containing tags', async () => {
    const { wrapper, aw } = editor(timer(['research, development', 'work']));
    await openEditor(wrapper);
    const buttons = document.querySelectorAll('.b-form-tag-remove');
    (buttons[1] as HTMLButtonElement).click();
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual(['research, development']);
    wrapper.destroy();
  });

  test('editing only the label preserves original tag identities', async () => {
    const tags = ['research, development', 'work'];
    const { wrapper, aw } = editor(timer(tags));
    await openEditor(wrapper);
    await wrapper.setData({
      editedEvent: {
        ...wrapper.vm.editedEvent,
        data: {
          ...wrapper.vm.editedEvent.data,
          label: 'Renamed',
        },
      },
    });
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data).toMatchObject({ label: 'Renamed', tags });
    wrapper.destroy();
  });

  test.each([undefined, 'work, meeting', null, { legacy: 'work' }])(
    'editing only the label preserves a non-array tags value: %p',
    async tags => {
      const past = {
        ...timer(),
        data: { ...timer().data, ...(tags !== undefined ? { tags } : {}) },
      };
      const original = JSON.stringify(past);
      const { wrapper, aw } = editor(past);
      await openEditor(wrapper);
      await wrapper.setData({
        editedEvent: {
          ...wrapper.vm.editedEvent,
          data: { ...wrapper.vm.editedEvent.data, label: 'Renamed' },
        },
      });
      await wrapper.vm.save();
      expect(aw.replaceEvent.mock.calls[0][1].data).toEqual({ ...past.data, label: 'Renamed' });
      expect(JSON.stringify(past)).toBe(original);
      wrapper.destroy();
    }
  );

  test('shows and clears legacy string tags without changing the historical event', async () => {
    const past = { ...timer(), data: { ...timer().data, tags: 'work, meeting' } };
    const { wrapper, aw } = editor(past);
    await openEditor(wrapper);
    const buttons = Array.from(document.querySelectorAll('.b-form-tag-remove'));
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      (button as HTMLButtonElement).click();
    }
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual([]);
    expect(past.data.tags).toBe('work, meeting');
    wrapper.destroy();
  });

  test('adding then removing a tag can explicitly clear a legacy string', async () => {
    const past = { ...timer(), data: { ...timer().data, tags: 'work' } };
    const { wrapper, aw } = editor(past);
    await openEditor(wrapper);
    const input = document.querySelector('[data-testid="event-tags"]') as HTMLInputElement;
    input.value = 'temporary';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await wrapper.vm.$nextTick();
    for (const button of Array.from(document.querySelectorAll('.b-form-tag-remove'))) {
      (button as HTMLButtonElement).click();
    }
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual([]);
    expect(past.data.tags).toBe('work');
    wrapper.destroy();
  });

  test('an explicit tag edit replaces a legacy value with an array', async () => {
    const past = { ...timer(), data: { ...timer().data, tags: 'legacy' } };
    const { wrapper, aw } = editor(past);
    await openEditor(wrapper);
    for (const button of Array.from(document.querySelectorAll('.b-form-tag-remove'))) {
      (button as HTMLButtonElement).click();
    }
    await wrapper.vm.$nextTick();
    const input = document.querySelector('[data-testid="event-tags"]') as HTMLInputElement;
    input.value = 'work';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual(['work']);
    expect(past.data.tags).toBe('legacy');
    wrapper.destroy();
  });

  test('allows clearing all tags', async () => {
    const { wrapper, aw } = editor(timer(['old']));
    await openEditor(wrapper);
    for (const button of Array.from(document.querySelectorAll('.b-form-tag-remove'))) {
      (button as HTMLButtonElement).click();
    }
    await wrapper.vm.$nextTick();
    await wrapper.vm.save();
    expect(aw.replaceEvent.mock.calls[0][1].data.tags).toEqual([]);
    wrapper.destroy();
  });

  test('a late event load cannot overwrite the selected event tags', async () => {
    const { wrapper, aw } = editor(timer(['first']));
    await flush();
    let resolveOld;
    const oldLoad = new Promise(resolve => {
      resolveOld = resolve;
    });
    aw.getEvent.mockReturnValueOnce(oldLoad);
    const reloading = wrapper.vm.getEvent();
    expect(wrapper.vm.tags).toEqual([]);
    await wrapper.vm.save();
    expect(aw.replaceEvent).not.toHaveBeenCalled();

    const nextEvent = { ...timer(['second']), id: 2 };
    aw.getEvent.mockResolvedValueOnce(nextEvent);
    await wrapper.setProps({ event: nextEvent });
    await flush();
    resolveOld(timer(['obsolete']));
    await reloading;
    expect(wrapper.vm.tags).toEqual(['second']);
    await wrapper.vm.save();
    expect(aw.replaceEvent).toHaveBeenCalledWith('aw-stopwatch', nextEvent);
    wrapper.destroy();
  });

  test('changing only the bucket replaces the tag draft for the same event ID', async () => {
    const { wrapper, aw } = editor(timer(['first']));
    await flush();
    await wrapper.setData({ tags: ['unsaved'] });
    const nextEvent = timer(['other bucket']);
    aw.getEvent.mockResolvedValueOnce(nextEvent);
    await wrapper.setProps({ bucket_id: 'other-stopwatch' });
    await flush();
    expect(wrapper.vm.tags).toEqual(['other bucket']);
    await wrapper.vm.save();
    expect(aw.replaceEvent).toHaveBeenCalledWith('other-stopwatch', nextEvent);
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
