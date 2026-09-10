import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';

import EventEditor from '~/components/EventEditor.vue';

const localVue = createLocalVue();
localVue.use(BootstrapVue);
localVue.filter('friendlyduration', v => String(v));

// A promise whose settlement the test controls, so "request in flight" is an
// observable state rather than a race.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

// BootstrapVue renders modal body content into document.body, and only once
// the modal is shown — so visible-text assertions have to open it first.
async function showModal(wrapper) {
  wrapper.vm.$refs.eventEditModal.show();
  await flush();
  await wrapper.vm.$nextTick();
}

const visibleText = () => document.body.textContent;

function makeEvent(id = 1) {
  return {
    id,
    timestamp: '2026-09-10T12:00:00+00:00',
    duration: 60,
    data: { title: 'original' },
  };
}

// Mounts the editor with a stubbed client. getEvent resolves immediately with a
// copy, mirroring the real flow where the editor re-fetches the event.
function mountEditor({ event = makeEvent(), replaceEvent, deleteEvent } = {}) {
  const $aw = {
    getEvent: jest.fn().mockImplementation(async () => JSON.parse(JSON.stringify(event))),
    replaceEvent: replaceEvent || jest.fn().mockResolvedValue(undefined),
    deleteEvent: deleteEvent || jest.fn().mockResolvedValue(undefined),
  };

  const wrapper = mount(EventEditor, {
    localVue,
    propsData: { event, bucket_id: 'test-bucket' },
    mocks: { $aw },
    stubs: { datetime: true, icon: true },
    attachTo: document.body,
  });

  return { wrapper, $aw };
}

describe('EventEditor save', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not emit save or close while the request is in flight', async () => {
    const pending = deferred();
    const { wrapper } = mountEditor({
      replaceEvent: jest.fn().mockReturnValue(pending.promise),
    });
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.save();
    await flush();

    expect(wrapper.emitted('save')).toBeUndefined();
    expect(hide).not.toHaveBeenCalled();
    expect(wrapper.vm.busy).toBe(true);

    pending.resolve();
    await flush();
  });

  test('emits save once with the edited event, then closes', async () => {
    const { wrapper, $aw } = mountEditor();
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.editedEvent.data.title = 'edited';
    await wrapper.vm.save();
    await flush();

    expect($aw.replaceEvent).toHaveBeenCalledTimes(1);
    expect($aw.replaceEvent).toHaveBeenCalledWith('test-bucket', wrapper.vm.editedEvent);
    expect(wrapper.emitted('save')).toHaveLength(1);
    // Payload compatibility: save emits the edited event.
    expect(wrapper.emitted('save')[0][0].data.title).toBe('edited');
    expect(hide).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.busy).toBe(false);
  });

  test('closes the modal before notifying the parent', async () => {
    const { wrapper } = mountEditor();
    await flush();

    const order = [];
    jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide').mockImplementation(() => order.push('hide'));
    wrapper.vm.$on('save', () => order.push('emit'));

    await wrapper.vm.save();
    await flush();

    expect(order).toEqual(['hide', 'emit']);
  });

  test('a failed request emits nothing, shows the error, and keeps the input', async () => {
    const failure = Object.assign(new Error('Request failed'), {
      response: { data: { message: 'server exploded' } },
    });
    const replaceEvent = jest.fn().mockRejectedValue(failure);
    const { wrapper } = mountEditor({ replaceEvent });
    await flush();
    await showModal(wrapper);
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.editedEvent.data.title = 'edited';
    await wrapper.vm.save();
    await flush();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('save')).toBeUndefined();
    expect(hide).not.toHaveBeenCalled();
    expect(wrapper.vm.error).toBe('server exploded');
    expect(visibleText()).toContain('server exploded');
    // The user's edit is still there to retry with.
    expect(wrapper.vm.editedEvent.data.title).toBe('edited');
    expect(wrapper.vm.busy).toBe(false);
  });

  test('falls back to the error message when the server sends no detail', async () => {
    const replaceEvent = jest.fn().mockRejectedValue(new Error('Network Error'));
    const { wrapper } = mountEditor({ replaceEvent });
    await flush();

    await wrapper.vm.save();
    expect(wrapper.vm.error).toBe('Network Error');
  });

  test('a retry after a failure succeeds and clears the error', async () => {
    const replaceEvent = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(undefined);
    const { wrapper } = mountEditor({ replaceEvent });
    await flush();

    await wrapper.vm.save();
    expect(wrapper.vm.error).toBe('Network Error');
    expect(wrapper.emitted('save')).toBeUndefined();

    await wrapper.vm.save();
    await flush();

    expect(replaceEvent).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.error).toBe('');
    expect(wrapper.emitted('save')).toHaveLength(1);
  });

  test('repeated clicks while pending cause only one request', async () => {
    const pending = deferred();
    const replaceEvent = jest.fn().mockReturnValue(pending.promise);
    const { wrapper } = mountEditor({ replaceEvent });
    await flush();

    const first = wrapper.vm.save();
    const second = wrapper.vm.save();
    const third = wrapper.vm.save();
    await flush();

    expect(replaceEvent).toHaveBeenCalledTimes(1);

    pending.resolve();
    await Promise.all([first, second, third]);
    await flush();

    expect(replaceEvent).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('save')).toHaveLength(1);
  });

  test('a late response is ignored once the editor moved to another event', async () => {
    const pending = deferred();
    const replaceEvent = jest.fn().mockReturnValue(pending.promise);
    const { wrapper } = mountEditor({ replaceEvent });
    await flush();

    const save = wrapper.vm.save();
    await flush();

    // The editor gets pointed at a different event mid-request.
    wrapper.setProps({ event: makeEvent(2) });
    await flush();

    pending.resolve();
    await save;
    await flush();

    expect(wrapper.emitted('save')).toBeUndefined();
  });
});

describe('EventEditor delete', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not emit delete while the request is in flight', async () => {
    const pending = deferred();
    const { wrapper } = mountEditor({
      deleteEvent: jest.fn().mockReturnValue(pending.promise),
    });
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.delete_();
    await flush();

    expect(wrapper.emitted('delete')).toBeUndefined();
    expect(hide).not.toHaveBeenCalled();

    pending.resolve();
    await flush();
  });

  test('emits delete once with the original event, then closes', async () => {
    const event = makeEvent();
    const { wrapper, $aw } = mountEditor({ event });
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    await wrapper.vm.delete_();
    await flush();

    expect($aw.deleteEvent).toHaveBeenCalledWith('test-bucket', event.id);
    expect(wrapper.emitted('delete')).toHaveLength(1);
    // Payload compatibility: delete emits the original event.
    expect(wrapper.emitted('delete')[0][0]).toBe(event);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  test('a failed delete emits nothing and surfaces the error', async () => {
    const deleteEvent = jest.fn().mockRejectedValue(new Error('nope'));
    const { wrapper } = mountEditor({ deleteEvent });
    await flush();

    await wrapper.vm.delete_();
    await flush();

    expect(wrapper.emitted('delete')).toBeUndefined();
    expect(wrapper.vm.error).toBe('nope');
  });

  test('repeated delete clicks while pending cause only one request', async () => {
    const pending = deferred();
    const deleteEvent = jest.fn().mockReturnValue(pending.promise);
    const { wrapper } = mountEditor({ deleteEvent });
    await flush();

    const first = wrapper.vm.delete_();
    const second = wrapper.vm.delete_();
    expect(deleteEvent).toHaveBeenCalledTimes(1);

    pending.resolve();
    await Promise.all([first, second]);
    expect(deleteEvent).toHaveBeenCalledTimes(1);
  });
});

describe('EventEditor cancel', () => {
  test('closes without sending a mutation request when idle', async () => {
    const { wrapper, $aw } = mountEditor();
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.close();
    await flush();

    expect(hide).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect($aw.replaceEvent).not.toHaveBeenCalled();
    expect($aw.deleteEvent).not.toHaveBeenCalled();
  });

  test('does not close while a request is pending', async () => {
    const pending = deferred();
    const { wrapper } = mountEditor({
      replaceEvent: jest.fn().mockReturnValue(pending.promise),
    });
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.save();
    await flush();
    wrapper.vm.close();

    expect(hide).not.toHaveBeenCalled();
    expect(wrapper.emitted('close')).toBeUndefined();

    pending.resolve();
    await flush();
  });

  test('dismissal is blocked only while busy', async () => {
    const pending = deferred();
    const { wrapper } = mountEditor({
      replaceEvent: jest.fn().mockReturnValue(pending.promise),
    });
    await flush();

    const modal = wrapper.findComponent({ ref: 'eventEditModal' });
    expect(modal.props('noCloseOnEsc')).toBe(false);
    expect(modal.props('noCloseOnBackdrop')).toBe(false);

    wrapper.vm.save();
    await wrapper.vm.$nextTick();

    expect(modal.props('noCloseOnEsc')).toBe(true);
    expect(modal.props('noCloseOnBackdrop')).toBe(true);
    expect(modal.props('hideHeaderClose')).toBe(true);

    pending.resolve();
    await flush();
  });
});

describe('EventEditor inside a parent that reacts to success', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Mirrors VisTimeline/EventList: the editor is rendered behind a v-if on the
  // event being edited, so a parent clearing it on save destroys the editor.
  function mountParent({ replaceEvent } = {}) {
    const $aw = {
      getEvent: jest.fn().mockImplementation(async () => makeEvent()),
      replaceEvent: replaceEvent || jest.fn().mockResolvedValue(undefined),
      deleteEvent: jest.fn().mockResolvedValue(undefined),
    };
    const saved = [];

    const Parent = {
      components: { EventEditor },
      data() {
        return { event: makeEvent() };
      },
      methods: {
        onSave(e) {
          saved.push(e);
          // Destroys the editor, as the real consumers do.
          this.event = null;
        },
      },
      render(h) {
        return h(
          'div',
          this.event
            ? [
                h(EventEditor, {
                  props: { event: this.event, bucket_id: 'test-bucket' },
                  on: { save: this.onSave },
                }),
              ]
            : []
        );
      },
    };

    const wrapper = mount(Parent, {
      localVue,
      mocks: { $aw },
      stubs: { datetime: true, icon: true },
      attachTo: document.body,
    });
    return { wrapper, $aw, saved };
  }

  test('a parent destroying the editor on save does not throw', async () => {
    const { wrapper, saved } = mountParent();
    await flush();

    const editor = wrapper.findComponent(EventEditor);
    await editor.vm.save();
    await flush();

    expect(saved).toHaveLength(1);
    expect(wrapper.findComponent(EventEditor).exists()).toBe(false);
    // No "cannot read property hide of undefined" from the teardown.
    expect(console.error).not.toHaveBeenCalled();
  });

  test('a failed save leaves the editor mounted in the parent', async () => {
    const { wrapper, saved } = mountParent({
      replaceEvent: jest.fn().mockRejectedValue(new Error('nope')),
    });
    await flush();

    const editor = wrapper.findComponent(EventEditor);
    await showModal(editor);
    await editor.vm.save();
    await flush();
    await editor.vm.$nextTick();

    expect(saved).toHaveLength(0);
    expect(wrapper.findComponent(EventEditor).exists()).toBe(true);
    expect(visibleText()).toContain('nope');
  });
});
