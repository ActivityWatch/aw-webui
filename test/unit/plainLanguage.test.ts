import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Home from '~/views/Home.vue';
import fs from 'fs';
import path from 'path';
import en from '~/i18n/locales/en';

beforeEach(() => createTestingPinia());

test('Home introduces watchers as tracking components and explains idle detection', () => {
  const wrapper = shallowMount(Home, {
    mocks: { $isAndroid: false },
    stubs: ['b-alert', 'b-button', 'router-link'],
  });
  expect(wrapper.text()).toContain('watchers');
  expect(wrapper.text()).toContain('keyboard or mouse');
  wrapper.destroy();
});

test('Raw Data explains collections, events and stable technical IDs', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');
  expect(source).toContain("$t('buckets.intro')");
  expect(en.buckets.title).toContain('Event collections');
  expect(en.buckets.intro).toContain('bucket');
  expect(en.buckets.intro).toContain('IDs');
});

test('English controls explain inactivity and missing data without asserting the user is inactive', () => {
  expect(en.activity.excludeAfk).toBe('Exclude inactive time');
  expect(en.timeline.filterAfk).toBe('Exclude inactive time');
  expect(en.activity.filterAfkTooltip).toContain('keyboard or mouse');
  expect(en.common.requiresAfk).toContain('idle-detection data');
  expect(en.visualizations.missingWatcher).toContain('missing data');
  expect(en.settings.activePattern.help1).toContain('inactive');
});
