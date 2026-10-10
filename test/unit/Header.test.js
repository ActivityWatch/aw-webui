import { createLocalVue, mount, shallowMount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
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

  function mountFullHeader() {
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    return mount(Header, {
      localVue,
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
