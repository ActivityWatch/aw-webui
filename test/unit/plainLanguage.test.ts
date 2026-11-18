import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Home from '~/views/Home.vue';

import fs from 'fs';
import path from 'path';
import en from '~/i18n/locales/en';

beforeEach(() => createTestingPinia());

test.each([['Home', Home, en.home.trackingIntro]])(
  '%s keeps explanations behind a focusable help icon',
  (_name, component, explanation) => {
    const wrapper = shallowMount(component, {
      mocks: { $isAndroid: false },
      stubs: ['b-alert', 'b-button', 'b-popover', 'router-link', 'icon'],
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
    expect(docs.attributes('href')).toBe('https://docs.activitywatch.net/en/latest/watchers.html');
    expect(docs.attributes('target')).toBe('_blank');
    expect(docs.attributes('rel')).toBe('noopener');
    wrapper.destroy();
  }
);

test.each([
  ['Buckets', 'buckets.intro', 'buckets-help'],
  ['Timeline', 'timeline.intro', 'timeline-help'],
])('%s uses the existing on-demand help pattern', (view, key, target) => {
  const source = fs.readFileSync(path.join(__dirname, `../../src/views/${view}.vue`), 'utf8');
  expect(source).not.toContain(`p {{ $t('${key}') }}`);
  expect(source).toContain(`button#${target}.btn.btn-link`);
  expect(source).toContain(':aria-label="$t(\'common.moreInformation\')"');
  expect(source).toContain(`b-popover(target="${target}" triggers="hover focus click blur"`);
  expect(source).toContain(`| {{ $t('${key}') }}`);
  const docsPage = view === 'Buckets' ? 'buckets-and-events' : 'watchers';
  expect(source).toContain(`href="https://docs.activitywatch.net/en/latest/${docsPage}.html"`);
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
