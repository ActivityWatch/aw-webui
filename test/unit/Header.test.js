import { shallowMount } from '@vue/test-utils';
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

  function mountHeader(researchEdition) {
    return shallowMount(Header, {
      data() {
        return {
          activityViews: [],
          fixedTopMenu: false,
          researchEdition,
        };
      },
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

  test.each([
    [true, true],
    [false, false],
    [undefined, false],
  ])('maps the build flag %p to researchEdition=%p', (buildFlag, expected) => {
    if (buildFlag === undefined) {
      delete global.AW_RESEARCH_EDITION;
    } else {
      global.AW_RESEARCH_EDITION = buildFlag;
    }

    const data = Header.data.call({ $isAndroid: false });

    expect(data.researchEdition).toBe(expected);
  });
});
