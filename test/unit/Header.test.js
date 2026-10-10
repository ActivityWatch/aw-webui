import { createLocalVue, mount, shallowMount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import VueRouter from 'vue-router';
const flushPromises = () => new Promise(resolve => setTimeout(resolve));
import { createPinia, setActivePinia } from 'pinia';
import Header from '~/components/Header.vue';

const mockEnsureLoaded = jest.fn().mockResolvedValue(undefined);
const passthroughStub = { template: '<div><slot /></div>' };

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: mockEnsureLoaded,
    buckets: [],
  }),
}));

describe('Header research edition badge', () => {
  afterEach(() => {
    delete global.AW_RESEARCH_EDITION;
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    mockEnsureLoaded.mockClear();
  });

  function mountHeader(buildFlag) {
    if (buildFlag === undefined) {
      delete global.AW_RESEARCH_EDITION;
    } else {
      global.AW_RESEARCH_EDITION = buildFlag;
    }

    return shallowMount(Header, {
      mocks: {
        $isAndroid: false,
        $t: key => key,
      },
      stubs: {
        'b-navbar': passthroughStub,
        'b-navbar-nav': passthroughStub,
        'b-navbar-brand': passthroughStub,
        'b-navbar-toggle': passthroughStub,
        'b-collapse': passthroughStub,
        'b-nav-item': passthroughStub,
        'b-nav-item-dropdown': passthroughStub,
        'b-dropdown-item': passthroughStub,
        'b-badge': passthroughStub,
        'b-sidebar': true,
        icon: passthroughStub,
      },
    });
  }

  test('renders a badge in both brand sites for research builds', () => {
    const wrapper = mountHeader(true);

    expect(wrapper.findAll('[data-testid="research-edition-badge"]')).toHaveLength(2);
  });

  test('renders no badge for standard builds', () => {
    const wrapper = mountHeader(false);

    expect(wrapper.findAll('[data-testid="research-edition-badge"]')).toHaveLength(0);
  });

  test('renders no badge when the build flag is absent', () => {
    const wrapper = mountHeader(undefined);

    expect(wrapper.findAll('[data-testid="research-edition-badge"]')).toHaveLength(0);
  });
});

describe('Header phone navigation drawer', () => {
  let mediaListeners;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockEnsureLoaded.mockClear();
    mediaListeners = [];
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: (_event, fn) => mediaListeners.push(fn),
      removeEventListener: jest.fn(),
    });
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  function mountFullHeader(router) {
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    if (router) {
      localVue.use(VueRouter);
    }
    return mount(Header, {
      localVue,
      router,
      attachTo: document.body,
      mocks: {
        $isAndroid: false,
        $t: key => key,
      },
      stubs: { icon: true },
    });
  }

  test('the toggle opens the drawer as a modal dialog', async () => {
    const wrapper = mountFullHeader();
    await flushPromises();

    const toggle = wrapper.find('[data-testid="nav-drawer-toggle"]');
    expect(toggle.attributes('aria-controls')).toBe('nav-drawer');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(wrapper.vm.drawerOpen).toBe(false);

    // v-b-toggle attaches its click listener in requestAnimationFrame
    await new Promise(resolve => setTimeout(resolve, 50));
    await toggle.trigger('click');
    await flushPromises();

    expect(wrapper.vm.drawerOpen).toBe(true);
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('#nav-drawer').attributes('aria-modal')).toBe('true');
    wrapper.destroy();
  });

  test('the drawer lists the same entries as the desktop navbar', () => {
    const wrapper = shallowMount(Header, {
      mocks: { $isAndroid: false, $t: key => key },
      stubs: {
        'b-navbar': passthroughStub,
        'b-navbar-nav': passthroughStub,
        'b-collapse': passthroughStub,
        'b-sidebar': passthroughStub,
        'b-nav-item': passthroughStub,
        'b-nav-item-dropdown': passthroughStub,
        'b-dropdown-item': passthroughStub,
        'b-navbar-brand': true,
        'b-navbar-toggle': true,
        icon: true,
      },
    });
    const desktopText = wrapper.find('#nav-collapse').text();
    const drawerText = wrapper.find('#nav-drawer').text();
    for (const key of [
      'nav.timeline',
      'nav.stopwatch',
      'nav.search',
      'nav.rawData',
      'nav.settings',
    ]) {
      expect(desktopText).toContain(key);
      expect(drawerText).toContain(key);
    }
  });

  test('navigating to another page closes the drawer', async () => {
    const router = new VueRouter({
      routes: [
        { path: '/', component: { render: h => h('div') } },
        { path: '/stopwatch', component: { render: h => h('div') } },
      ],
    });
    const wrapper = mountFullHeader(router);
    await flushPromises();
    await wrapper.setData({ drawerOpen: true });
    await flushPromises();

    await router.push('/stopwatch');
    await flushPromises();

    expect(wrapper.vm.$route.path).toBe('/stopwatch');
    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.destroy();
  });

  test('Escape closes the drawer', async () => {
    const wrapper = mountFullHeader();
    await flushPromises();
    await wrapper.setData({ drawerOpen: true });
    await flushPromises();

    await wrapper.find('#nav-drawer').trigger('keydown', { keyCode: 27 });
    await flushPromises();

    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.destroy();
  });

  test('growing to desktop width closes the drawer', async () => {
    const wrapper = mountFullHeader();
    await flushPromises();
    await wrapper.setData({ drawerOpen: true });

    mediaListeners.forEach(fn => fn({ matches: true }));
    await flushPromises();

    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.destroy();
  });
});

describe('Header native Android actions', () => {
  let bridge;

  // Mirrors the object aw-android injects through WebMessageListener.
  function installBridge({ actions } = {}) {
    const listeners = [];
    bridge = {
      sent: [],
      postMessage: jest.fn(msg => {
        bridge.sent.push(JSON.parse(msg));
        if (actions && JSON.parse(msg).type === 'hello') {
          const reply = JSON.stringify({ type: 'capabilities', version: 1, actions });
          listeners.forEach(fn => fn({ data: reply }));
        }
      }),
      addEventListener: jest.fn((_type, fn) => listeners.push(fn)),
      removeEventListener: jest.fn(),
      emit: data => listeners.forEach(fn => fn({ data })),
    };
    window.awNativeBridge = bridge;
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  });

  afterEach(() => {
    delete window.awNativeBridge;
    delete window.matchMedia;
  });

  function mountWithDrawer() {
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    return mount(Header, {
      localVue,
      attachTo: document.body,
      mocks: { $isAndroid: false, $t: key => key },
      stubs: { icon: true },
    });
  }

  test('browsers without the bridge show no native actions', async () => {
    const wrapper = mountWithDrawer();
    await wrapper.setData({ drawerOpen: true });
    await flushPromises();

    expect(wrapper.findAll('[data-testid^="nav-native-"]')).toHaveLength(0);
    wrapper.destroy();
  });

  test('a bridge that reports no capabilities shows no native actions', async () => {
    installBridge();
    const wrapper = mountWithDrawer();
    await wrapper.setData({ drawerOpen: true });
    await flushPromises();

    expect(bridge.sent[0]).toEqual({ type: 'hello' });
    expect(wrapper.findAll('[data-testid^="nav-native-"]')).toHaveLength(0);
    wrapper.destroy();
  });

  test('shows only the reported, known actions and runs them on tap', async () => {
    installBridge({ actions: ['sync-settings', 'open-in-browser', 'open-url'] });
    const wrapper = mountWithDrawer();
    await wrapper.setData({ drawerOpen: true });
    await flushPromises();

    expect(wrapper.find('[data-testid="nav-native-sync-settings"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-native-open-in-browser"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-native-auth-settings"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="nav-native-open-url"]')).toHaveLength(0);

    await wrapper.find('[data-testid="nav-native-sync-settings"] a').trigger('click');
    await flushPromises();

    expect(bridge.sent).toContainEqual({ type: 'action', action: 'sync-settings' });
    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.destroy();
  });

  test('native actions render in the phone drawer as well as the desktop navbar', () => {
    installBridge({ actions: ['sync-settings', 'auth-settings', 'open-in-browser'] });
    const wrapper = shallowMount(Header, {
      mocks: { $isAndroid: false, $t: key => key },
      stubs: {
        'b-navbar': passthroughStub,
        'b-navbar-nav': passthroughStub,
        'b-collapse': passthroughStub,
        'b-sidebar': passthroughStub,
        'b-nav-item': passthroughStub,
        'b-nav-item-dropdown': passthroughStub,
        'b-dropdown-item': passthroughStub,
        'b-navbar-brand': true,
        'b-navbar-toggle': true,
        icon: true,
      },
    });
    for (const selector of ['#nav-collapse', '#nav-drawer']) {
      const text = wrapper.find(selector).text();
      for (const key of ['nav.syncSettings', 'nav.apiAuthentication', 'nav.openInBrowser']) {
        expect(text).toContain(key);
      }
    }
  });

  test('reports drawer state and closes on a native close-menu request', async () => {
    installBridge({ actions: ['sync-settings'] });
    const wrapper = mountWithDrawer();
    await flushPromises();

    await wrapper.setData({ drawerOpen: true });
    await flushPromises();
    expect(bridge.sent).toContainEqual({ type: 'menu', open: true });

    bridge.emit(JSON.stringify({ type: 'close-menu' }));
    await flushPromises();
    expect(wrapper.vm.drawerOpen).toBe(false);
    expect(bridge.sent).toContainEqual({ type: 'menu', open: false });

    // Malformed or unexpected messages are ignored.
    await wrapper.setData({ drawerOpen: true });
    bridge.emit('not json');
    bridge.emit(JSON.stringify({ type: 'capabilities', version: 2, actions: ['auth-settings'] }));
    await flushPromises();
    expect(wrapper.vm.drawerOpen).toBe(true);
    expect(wrapper.findAll('[data-testid="nav-native-auth-settings"]')).toHaveLength(0);

    wrapper.destroy();
    expect(bridge.removeEventListener).toHaveBeenCalled();
  });
});
