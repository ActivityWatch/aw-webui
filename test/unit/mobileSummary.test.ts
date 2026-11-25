import { createPinia, setActivePinia } from 'pinia';
import { useViewsStore, defaultViews, androidViews } from '~/stores/views';

const copy = value => JSON.parse(JSON.stringify(value));

beforeEach(() => setActivePinia(createPinia()));

// Only presentation changes: saved/draft order must remain the editor's source of truth.
test.each([
  ['desktop', defaultViews],
  ['Android', androidViews],
])('%s untouched summary is eligible for chart-first phone presentation', (_platform, views) => {
  const store = useViewsStore();
  store.loadViews(copy(views));
  const before = copy(store.views);
  expect(store.isDefaultSummary(store.views[0])).toBe(true);
  expect(store.views).toEqual(before);
});

test('explicitly reordered, renamed, resized, configured and custom views keep their order', () => {
  const store = useViewsStore();
  for (const change of [
    view => view.elements.reverse(),
    view => (view.name = 'My summary'),
    view => (view.elements[0].size = 6),
    view => (view.elements[0].props = { custom: true }),
    view => (view.id = 'custom'),
    view => view.elements.push({ type: 'top_bucket_data', size: 3 }),
  ]) {
    const view = copy(defaultViews[0]);
    change(view);
    expect(store.isDefaultSummary(view)).toBe(false);
  }
});

test('a desktop-only width choice does not disable phone chart-first presentation', () => {
  const store = useViewsStore();
  // Width has no effect below md, so this stays presentation-equivalent to the
  // default summary even though it counts as a user edit for migration.
  const view = copy(defaultViews[0]);
  view.elements[0].width = 2;
  expect(store.isDefaultSummary(view)).toBe(true);
});

test('empty or missing summary is not a default layout', () => {
  const store = useViewsStore();
  expect(store.isDefaultSummary(undefined)).toBe(false);
  expect(store.isDefaultSummary({ id: 'summary', name: 'Summary', elements: [] })).toBe(false);
});
