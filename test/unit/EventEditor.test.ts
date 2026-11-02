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
function mountEditor({ event = makeEvent(), getEvent, replaceEvent, deleteEvent }: any = {}) {
  const $aw = {
    getEvent:
      getEvent || jest.fn().mockImplementation(async () => JSON.parse(JSON.stringify(event))),
    replaceEvent: replaceEvent || jest.fn().mockResolvedValue(undefined),
    deleteEvent: deleteEvent || jest.fn().mockResolvedValue(undefined),
  };

  const wrapper: any = mount(EventEditor, {
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
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not emit save or close while the request is in flight', async () => {
    const inFlight = deferred();
    const { wrapper } = mountEditor({
      replaceEvent: jest.fn().mockReturnValue(inFlight.promise),
    });
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.save();
    await flush();

    expect(wrapper.emitted('save')).toBeUndefined();
    expect(hide).not.toHaveBeenCalled();
    expect(wrapper.vm.busy).toBe(true);

    inFlight.resolve();
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

  test('emits the submitted snapshot even if the editable event changes during Save', async () => {
    const inFlight = deferred();
    const { wrapper, $aw } = mountEditor({
      replaceEvent: jest.fn().mockReturnValue(inFlight.promise),
    });
    await flush();
    wrapper.vm.editedEvent.data.title = 'submitted';
    const saving = wrapper.vm.save();
    wrapper.vm.editedEvent.data.title = 'not submitted';
    wrapper.vm.editedEvent.duration = 999;
    inFlight.resolve();
    await saving;
    const payload = wrapper.emitted('save')[0][0];
    expect(payload.data.title).toBe('submitted');
    expect(payload.duration).toBe(60);
    expect($aw.replaceEvent.mock.calls[0][1]).toEqual(payload);
    wrapper.destroy();
  });

  test('closes the modal before notifying the parent', async () => {
    const { wrapper } = mountEditor();
    await flush();

    const order = [];
    jest
      .spyOn(wrapper.vm.$refs.eventEditModal, 'hide')
      .mockImplementation(() => order.push('hide'));
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
    const inFlight = deferred();
    const replaceEvent = jest.fn().mockReturnValue(inFlight.promise);
    const { wrapper } = mountEditor({ replaceEvent });
    await flush();

    const first = wrapper.vm.save();
    const second = wrapper.vm.save();
    const third = wrapper.vm.save();
    await flush();

    expect(replaceEvent).toHaveBeenCalledTimes(1);

    inFlight.resolve();
    await Promise.all([first, second, third]);
    await flush();

    expect(replaceEvent).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('save')).toHaveLength(1);
  });

  test('a late response is ignored once the editor moved to another event', async () => {
    const inFlight = deferred();
    const replaceEvent = jest.fn().mockReturnValue(inFlight.promise);
    const { wrapper } = mountEditor({ replaceEvent });
    await flush();

    const save = wrapper.vm.save();
    await flush();

    // The editor gets pointed at a different event mid-request.
    wrapper.setProps({ event: makeEvent(2) });
    await flush();

    inFlight.resolve();
    await save;
    await flush();

    expect(wrapper.emitted('save')).toBeUndefined();
    // The server still changed the original event, so parents hear about that.
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(wrapper.emitted('saved')[0][0].id).toBe(1);
  });
});

describe('EventEditor delete', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not emit delete while the request is in flight', async () => {
    const inFlight = deferred();
    const { wrapper } = mountEditor({
      deleteEvent: jest.fn().mockReturnValue(inFlight.promise),
    });
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.delete_();
    await flush();

    expect(wrapper.emitted('delete')).toBeUndefined();
    expect(hide).not.toHaveBeenCalled();

    inFlight.resolve();
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
    const inFlight = deferred();
    const deleteEvent = jest.fn().mockReturnValue(inFlight.promise);
    const { wrapper } = mountEditor({ deleteEvent });
    await flush();

    const first = wrapper.vm.delete_();
    const second = wrapper.vm.delete_();
    expect(deleteEvent).toHaveBeenCalledTimes(1);

    inFlight.resolve();
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
    const inFlight = deferred();
    const { wrapper } = mountEditor({
      replaceEvent: jest.fn().mockReturnValue(inFlight.promise),
    });
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

    wrapper.vm.save();
    await flush();
    wrapper.vm.close();

    expect(hide).not.toHaveBeenCalled();
    expect(wrapper.emitted('close')).toBeUndefined();

    inFlight.resolve();
    await flush();
  });

  test('dismissal is blocked only while busy', async () => {
    const inFlight = deferred();
    const { wrapper } = mountEditor({
      replaceEvent: jest.fn().mockReturnValue(inFlight.promise),
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

    inFlight.resolve();
    await flush();
  });
});

describe('EventEditor inside a parent that reacts to success', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Mirrors VisTimeline/EventList: the editor is rendered behind a v-if on the
  // event being edited, so a parent clearing it on save destroys the editor.
  function mountParent({ replaceEvent }: any = {}) {
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

    const wrapper: any = mount(Parent, {
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

describe('EventEditor draft ownership', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('a late load cannot replace the current selection draft', async () => {
    const oldLoad = deferred();
    const newLoad = deferred();
    const getEvent = jest
      .fn()
      .mockReturnValueOnce(oldLoad.promise)
      .mockReturnValueOnce(newLoad.promise);
    const { wrapper, $aw } = mountEditor({ getEvent });

    await wrapper.setProps({ bucket_id: 'other-bucket', event: makeEvent(2) });
    newLoad.resolve(makeEvent(2));
    await flush();
    oldLoad.resolve(makeEvent(1));
    await flush();

    expect(wrapper.vm.editedEvent.id).toBe(2);
    await wrapper.vm.save();
    expect($aw.replaceEvent).toHaveBeenCalledWith('other-bucket', makeEvent(2));
    wrapper.destroy();
  });

  test('selection changes hide the old draft and block saving until the new load succeeds', async () => {
    const nextLoad = deferred();
    const getEvent = jest
      .fn()
      .mockResolvedValueOnce(makeEvent())
      .mockReturnValueOnce(nextLoad.promise);
    const { wrapper, $aw } = mountEditor({ getEvent });
    await flush();
    await showModal(wrapper);
    expect(
      Array.from(document.body.querySelectorAll('input')).some(input => input.value === 'original')
    ).toBe(true);

    await wrapper.setProps({ bucket_id: 'other-bucket', event: makeEvent(2) });
    await flush();
    expect(wrapper.vm.editedEvent).toBeNull();
    expect(
      Array.from(document.body.querySelectorAll('input')).some(input => input.value === 'original')
    ).toBe(false);
    await wrapper.vm.save();
    expect($aw.replaceEvent).not.toHaveBeenCalled();

    nextLoad.resolve(makeEvent(2));
    await flush();
    await wrapper.vm.save();
    expect($aw.replaceEvent).toHaveBeenCalledWith('other-bucket', makeEvent(2));
    wrapper.destroy();
  });

  test('reopening the same event discards cancelled edits and reloads current server data', async () => {
    const reload = deferred();
    const getEvent = jest
      .fn()
      .mockResolvedValueOnce(makeEvent())
      .mockReturnValueOnce(reload.promise);
    const { wrapper, $aw } = mountEditor({ getEvent });
    await flush();
    await showModal(wrapper);
    wrapper.vm.editedEvent.data.title = 'cancelled edit';
    wrapper.vm.close();
    await flush();

    // VisTimeline fetches a fresh object, but keeps the same editor mounted.
    const current = { ...makeEvent(), data: { title: 'newer server value' } };
    await wrapper.setProps({ event: current });
    await showModal(wrapper);
    expect(wrapper.vm.editedEvent).toBeNull();
    expect(visibleText()).not.toContain('cancelled edit');
    await wrapper.vm.save();
    expect($aw.replaceEvent).not.toHaveBeenCalled();
    expect(getEvent).toHaveBeenCalledTimes(2);

    reload.resolve(current);
    await flush();
    await wrapper.vm.save();
    expect($aw.replaceEvent).toHaveBeenCalledWith('test-bucket', current);
    wrapper.destroy();
  });

  test('same-tick replacement with the same ID blocks old-draft mutations before watchers', async () => {
    const { wrapper, $aw } = mountEditor();
    await flush();
    wrapper.vm.$props.event = makeEvent();
    await wrapper.vm.save();
    await wrapper.vm.delete_();
    expect($aw.replaceEvent).not.toHaveBeenCalled();
    expect($aw.deleteEvent).not.toHaveBeenCalled();
    wrapper.destroy();
  });

  test.each(['success', 'failure'])(
    'a same-ID reopen ignores old mutation %s UI effects',
    async outcome => {
      const save = deferred();
      const { wrapper } = mountEditor({ replaceEvent: jest.fn().mockReturnValue(save.promise) });
      await flush();
      const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');
      const saving = wrapper.vm.save();
      // Settle before the replacement watcher runs: source identity must guard
      // the completion independently of the load sequence.
      wrapper.vm.$props.event = makeEvent();
      if (outcome === 'success') save.resolve();
      else save.reject(new Error('obsolete save failed'));
      await saving;
      await flush();
      expect(hide).not.toHaveBeenCalled();
      expect(wrapper.vm.error).toBe('');
      expect(wrapper.emitted('save')).toBeUndefined();
      if (outcome === 'success') {
        expect(wrapper.emitted('saved')[0]).toEqual([makeEvent(), 'test-bucket']);
      } else {
        expect(wrapper.emitted('saved')).toBeUndefined();
      }
      wrapper.destroy();
    }
  );

  test('a replacement object with the same ID invalidates the previous pending load', async () => {
    const oldLoad = deferred();
    const reload = deferred();
    const getEvent = jest
      .fn()
      .mockReturnValueOnce(oldLoad.promise)
      .mockReturnValueOnce(reload.promise);
    const { wrapper } = mountEditor({ getEvent });
    await wrapper.setProps({ event: makeEvent() });
    oldLoad.resolve(makeEvent());
    await flush();
    expect(wrapper.vm.editedEvent).toBeNull();
    const current = { ...makeEvent(), data: { title: 'reopened' } };
    reload.resolve(current);
    await flush();
    expect(wrapper.vm.editedEvent).toEqual(current);
    wrapper.destroy();
  });

  test.each(['save', 'delete_'])(
    '%s completion invalidates a returning draft loaded before the mutation committed',
    async action => {
      const mutation = deferred();
      const reconciliation = deferred();
      const getEvent = jest
        .fn()
        .mockResolvedValueOnce(makeEvent())
        .mockResolvedValueOnce(makeEvent(2))
        .mockResolvedValueOnce(makeEvent())
        .mockReturnValueOnce(reconciliation.promise);
      const request = jest.fn().mockReturnValue(mutation.promise);
      const { wrapper, $aw } = mountEditor({
        getEvent,
        replaceEvent: request,
        deleteEvent: request,
      });
      await flush();
      wrapper.vm.editedEvent.data.title = 'confirmed update';
      const writing = wrapper.vm[action]();
      await wrapper.setProps({ event: makeEvent(2) });
      await flush();
      await wrapper.setProps({ event: makeEvent() });
      await flush();
      expect(wrapper.vm.editedEvent.data.title).toBe('original');
      const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');

      mutation.resolve();
      await writing;
      expect(wrapper.vm.draftReady).toBe(false);
      expect(wrapper.vm.editedEvent).toBeNull();
      expect(getEvent).toHaveBeenCalledTimes(4);
      expect(hide).not.toHaveBeenCalled();
      expect(wrapper.emitted(action === 'save' ? 'saved' : 'deleted')).toHaveLength(1);
      await wrapper.vm.save();
      await wrapper.vm.delete_();
      expect(request).toHaveBeenCalledTimes(1);

      if (action === 'save') {
        const confirmed = { ...makeEvent(), data: { title: 'confirmed update' } };
        reconciliation.resolve(confirmed);
        await flush();
        await wrapper.vm.save();
        expect($aw.replaceEvent).toHaveBeenLastCalledWith('test-bucket', confirmed);
      } else {
        reconciliation.reject(new Error('event no longer exists'));
        await flush();
        expect(wrapper.vm.draftReady).toBe(false);
        expect(wrapper.vm.error).toBe('event no longer exists');
        await wrapper.vm.save();
        expect(request).toHaveBeenCalledTimes(1);
      }
      wrapper.destroy();
    }
  );

  test('a post-save reload supersedes a same-session read still in flight', async () => {
    const mutation = deferred();
    const staleLoad = deferred();
    const confirmedLoad = deferred();
    const getEvent = jest
      .fn()
      .mockResolvedValueOnce(makeEvent())
      .mockReturnValueOnce(staleLoad.promise)
      .mockReturnValueOnce(confirmedLoad.promise);
    const { wrapper } = mountEditor({
      getEvent,
      replaceEvent: jest.fn().mockReturnValue(mutation.promise),
    });
    await flush();
    const writing = wrapper.vm.save();
    const reloading = wrapper.vm.getEvent();
    mutation.resolve();
    await writing;
    staleLoad.resolve(makeEvent());
    await reloading;
    expect(wrapper.vm.draftReady).toBe(false);
    const confirmed = { ...makeEvent(), data: { title: 'confirmed update' } };
    confirmedLoad.resolve(confirmed);
    await flush();
    expect(wrapper.vm.editedEvent).toEqual(confirmed);
    wrapper.destroy();
  });

  test('a bucket-only change reloads even when the event ID and prop object are unchanged', async () => {
    const nextLoad = deferred();
    const getEvent = jest
      .fn()
      .mockResolvedValueOnce(makeEvent())
      .mockReturnValueOnce(nextLoad.promise);
    const { wrapper, $aw } = mountEditor({ getEvent });
    await flush();

    await wrapper.setProps({ bucket_id: 'other-bucket' });
    expect(getEvent).toHaveBeenLastCalledWith('other-bucket', 1);
    await wrapper.vm.save();
    expect($aw.replaceEvent).not.toHaveBeenCalled();

    const nextEvent = { ...makeEvent(), data: { title: 'other bucket' } };
    nextLoad.resolve(nextEvent);
    await flush();
    await wrapper.vm.save();
    expect($aw.replaceEvent).toHaveBeenCalledWith('other-bucket', nextEvent);
    wrapper.destroy();
  });

  test('an obsolete failure cannot replace the current draft or error', async () => {
    const oldLoad = deferred();
    const getEvent = jest
      .fn()
      .mockReturnValueOnce(oldLoad.promise)
      .mockResolvedValueOnce(makeEvent(2));
    const { wrapper } = mountEditor({ getEvent });
    await wrapper.setProps({ event: makeEvent(2) });
    await flush();
    oldLoad.reject(new Error('obsolete failure'));
    await flush();

    expect(wrapper.vm.editedEvent.id).toBe(2);
    expect(wrapper.vm.error).toBe('');
    wrapper.destroy();
  });

  test('a current load error is visible and can be retried without enabling stale saves', async () => {
    const getEvent = jest
      .fn()
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValueOnce(makeEvent());
    const { wrapper, $aw } = mountEditor({ getEvent });
    await flush();
    await showModal(wrapper);

    expect(visibleText()).toContain('load failed');
    expect(wrapper.vm.editedEvent).toBeNull();
    await wrapper.vm.save();
    expect($aw.replaceEvent).not.toHaveBeenCalled();
    const retry = Array.from(document.body.querySelectorAll('button')).find(button =>
      button.textContent.includes('Refresh')
    );
    expect(retry).toBeDefined();
    retry.click();
    await flush();
    expect(wrapper.vm.error).toBe('');
    expect(wrapper.vm.editedEvent.id).toBe(1);
    await wrapper.vm.save();
    expect($aw.replaceEvent).toHaveBeenCalledTimes(1);
    wrapper.destroy();
  });

  test('a newer reload of the same selection owns its draft', async () => {
    const oldLoad = deferred();
    const newLoad = deferred();
    const getEvent = jest
      .fn()
      .mockReturnValueOnce(oldLoad.promise)
      .mockReturnValueOnce(newLoad.promise);
    const { wrapper } = mountEditor({ getEvent });
    const reload = wrapper.vm.getEvent();
    const newest = { ...makeEvent(), data: { title: 'newest' } };
    newLoad.resolve(newest);
    await reload;
    oldLoad.resolve(makeEvent());
    await flush();
    expect(wrapper.vm.editedEvent).toEqual(newest);
    wrapper.destroy();
  });

  test('returning to the original selection does not revive its obsolete load', async () => {
    const oldLoad = deferred();
    const returningLoad = deferred();
    const getEvent = jest
      .fn()
      .mockReturnValueOnce(oldLoad.promise)
      .mockResolvedValueOnce(makeEvent(2))
      .mockReturnValueOnce(returningLoad.promise);
    const { wrapper, $aw } = mountEditor({ getEvent });
    await wrapper.setProps({ event: makeEvent(2) });
    await flush();
    await wrapper.setProps({ event: makeEvent(1) });
    oldLoad.resolve(makeEvent());
    await flush();
    expect(wrapper.vm.editedEvent).toBeNull();
    await wrapper.vm.save();
    expect($aw.replaceEvent).not.toHaveBeenCalled();
    returningLoad.resolve({ ...makeEvent(), data: { title: 'fresh' } });
    await flush();
    expect(wrapper.vm.editedEvent.data.title).toBe('fresh');
    wrapper.destroy();
  });

  test('same-tick bucket changes cannot submit the old draft before its watcher runs', async () => {
    const { wrapper, $aw } = mountEditor();
    await flush();
    // setProps itself queues the prop update. Assign the reactive prop here
    // to exercise the narrower interval after props change but before watchers.
    wrapper.vm.$props.bucket_id = 'other-bucket';
    await wrapper.vm.save();
    expect($aw.replaceEvent).not.toHaveBeenCalled();
    await wrapper.vm.$nextTick();
    wrapper.destroy();
  });

  test('clearing selection invalidates the draft and both mutation actions', async () => {
    const { wrapper, $aw } = mountEditor();
    await flush();
    await wrapper.setProps({ event: null });
    expect(wrapper.vm.editedEvent).toBeNull();
    await wrapper.vm.save();
    await wrapper.vm.delete_();
    expect($aw.replaceEvent).not.toHaveBeenCalled();
    expect($aw.deleteEvent).not.toHaveBeenCalled();
    wrapper.destroy();
  });

  test('destruction invalidates a pending load', async () => {
    const load = deferred();
    const { wrapper } = mountEditor({ getEvent: jest.fn().mockReturnValue(load.promise) });
    wrapper.destroy();
    load.resolve(makeEvent());
    await flush();
    expect(wrapper.vm.editedEvent).toBeNull();
  });

  test('an old-bucket mutation success reports its bucket without closing a new selection with the same ID', async () => {
    const save = deferred();
    const { wrapper } = mountEditor({ replaceEvent: jest.fn().mockReturnValue(save.promise) });
    await flush();
    const hide = jest.spyOn(wrapper.vm.$refs.eventEditModal, 'hide');
    const saving = wrapper.vm.save();
    await wrapper.setProps({ bucket_id: 'other-bucket' });
    await flush();
    save.resolve();
    await saving;
    expect(hide).not.toHaveBeenCalled();
    expect(wrapper.emitted('save')).toBeUndefined();
    expect(wrapper.emitted('saved')[0][1]).toBe('test-bucket');
    wrapper.destroy();
  });

  test('a completed delete after destruction reports only the original bucket completion', async () => {
    const deletion = deferred();
    const { wrapper, $aw } = mountEditor({
      deleteEvent: jest.fn().mockReturnValue(deletion.promise),
    });
    await flush();
    const deleting = wrapper.vm.delete_();
    wrapper.destroy();
    deletion.resolve();
    await deleting;
    expect($aw.deleteEvent).toHaveBeenCalledWith('test-bucket', 1);
    expect(wrapper.emitted('delete')).toBeUndefined();
    expect(wrapper.emitted('deleted')[0]).toEqual([makeEvent(), 'test-bucket']);
  });

  test('an old mutation failure cannot overwrite the new selection error', async () => {
    const save = deferred();
    const getEvent = jest
      .fn()
      .mockResolvedValueOnce(makeEvent())
      .mockRejectedValueOnce(new Error('current load failed'));
    const { wrapper } = mountEditor({
      getEvent,
      replaceEvent: jest.fn().mockReturnValue(save.promise),
    });
    await flush();
    const saving = wrapper.vm.save();
    await wrapper.setProps({ event: makeEvent(2) });
    await flush();
    save.reject(new Error('obsolete save failed'));
    await saving;
    expect(wrapper.vm.error).toBe('current load failed');
    wrapper.destroy();
  });
});
