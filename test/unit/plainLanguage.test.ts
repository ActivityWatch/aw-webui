import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Home from '~/views/Home.vue';
import Buckets from '~/views/Buckets.vue';
import Timeline from '~/views/Timeline.vue';

import en from '~/i18n/locales/en';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';

beforeEach(() => {
  createTestingPinia();
  (useSettingsStore().load as jest.Mock).mockResolvedValue(undefined);
  (useBucketsStore().ensureLoaded as jest.Mock).mockResolvedValue(undefined);
});

test.each([
  ['Home', Home, en.home.trackingIntro, 'watchers'],
  ['Buckets', Buckets, en.buckets.intro, 'buckets-and-events'],
  ['Timeline', Timeline, en.timeline.intro, 'watchers'],
])(
  '%s keeps explanations behind a focusable help icon',
  (_name, component, explanation, docsPage) => {
    const wrapper = shallowMount(component, {
      mocks: { $isAndroid: false },
      stubs: [
        'b-alert',
        'b-button',
        'b-popover',
        'router-link',
        'icon',
        'b-card',
        'b-card-group',
        'b-modal',
        'b-form-file',
        'b-button-group',
        'b-dropdown',
        'b-dropdown-header',
        'b-dropdown-item-button',
        'b-form-checkbox',
        'input-timeinterval',
        'aw-devonly',
        'aw-bucket-merge',
        'aw-bucket-validate',
      ],
    });
    const button = wrapper.find('h3 button');
    expect(button.exists()).toBe(true);
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-label')).toBe('More information');
    expect(button.find('icon-stub').attributes('name')).toBe('question-circle');
    const help = wrapper.find('b-popover-stub');
    expect(help.attributes('target')).toBe(button.attributes('id'));
    expect(help.attributes('triggers')).toBe('hover focus click blur');
    expect(help.text()).toContain(explanation);
    const docs = help.find('a');
    expect(docs.attributes('href')).toBe(
      `https://docs.activitywatch.net/en/latest/${docsPage}.html`
    );
    expect(docs.attributes('target')).toBe('_blank');
    expect(docs.attributes('rel')).toBe('noopener');
    expect(wrapper.findAll('p').wrappers.filter(p => p.text().includes(explanation))).toHaveLength(
      0
    );
    wrapper.destroy();
  }
);

test('Data has a short title and keeps bucket terminology in contextual help', () => {
  const wrapper = shallowMount(Buckets, {
    stubs: [
      'b-popover',
      'b-alert',
      'icon',
      'b-card',
      'b-card-group',
      'b-modal',
      'b-button',
      'b-form-file',
      'aw-devonly',
      'aw-bucket-merge',
      'aw-bucket-validate',
    ],
  });
  expect(wrapper.find('h3').text()).toBe('Data');
  expect(wrapper.find('b-popover-stub').text()).toContain(en.buckets.intro);
  wrapper.destroy();
  expect(en.buckets.title).toBe('Data');
  expect(en.nav.rawData).toBe('Data');
  expect(en.ui.bucketDetail.client).toBe('Client:');
  expect(en.ui.bucketDetail.hostname).toBe('Device:');
  expect(en.buckets.intro).toContain('bucket');
  expect(en.buckets.intro).toContain('events');
});

test('English controls explain inactivity and missing data without asserting the user is inactive', () => {
  expect(en.activity.excludeAfk).toBe('Exclude inactive time');
  // The Timeline filter row renders both side by side, so they must not repeat each other.
  expect(en.timeline.filterAfk).toBe('Filter window events');
  expect(en.activity.filterAfkTooltip).toContain('keyboard or mouse');
  expect(en.common.requiresAfk).toContain('idle-detection data');
  expect(en.visualizations.missingWatcher).toContain('missing data');
  expect(en.settings.activePattern.help1).toContain('inactive');
});
