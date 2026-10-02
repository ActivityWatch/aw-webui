import TopBucketData from '~/visualizations/TopBucketData.vue';

// Regression test for #935: switching between two views that both hold a Top
// Bucket Data vis at the same grid position reused the component instance
// (ActivityView keys its v-for by index), but the selection lived in data(),
// snapshotted from the initial* props at creation time, so the reused instance
// kept the previous view's bucket/field and never refreshed. The fix re-syncs
// local state from props via syncFromProps() whenever the props change.

const { syncFromProps } = TopBucketData.methods;

function makeCtx(overrides = {}) {
  const ctx = {
    initialBucketId: '',
    initialField: '',
    initialCustomField: '',
    selectedBucketId: '',
    selectedField: '',
    customField: '',
    defaultCalls: 0,
    setDefaultBucket() {
      ctx.defaultCalls += 1;
    },
    ...overrides,
  };
  return ctx;
}

describe('TopBucketData syncFromProps (#935)', () => {
  test('adopts the incoming view selection when the instance is reused', () => {
    const ctx = makeCtx({
      initialBucketId: 'aw-watcher-web_host',
      initialField: 'url',
      selectedBucketId: 'aw-watcher-window_host',
      selectedField: 'app',
    });
    syncFromProps.call(ctx);
    expect(ctx.selectedBucketId).toBe('aw-watcher-web_host');
    expect(ctx.selectedField).toBe('url');
    expect(ctx.defaultCalls).toBe(1);
  });

  test('is a no-op when props already match local state', () => {
    const ctx = makeCtx({
      initialBucketId: 'b',
      initialField: 'app',
      selectedBucketId: 'b',
      selectedField: 'app',
    });
    syncFromProps.call(ctx);
    // emitSelection() round-trips our own selection back through the parent's
    // stored props, so an unchanged prop must not re-trigger a default lookup.
    expect(ctx.defaultCalls).toBe(0);
    expect(ctx.selectedBucketId).toBe('b');
  });

  test('clears stale selection and falls back to default when the new view pins nothing', () => {
    const ctx = makeCtx({
      initialBucketId: '',
      initialField: '',
      selectedBucketId: 'stale-bucket',
      selectedField: 'app',
    });
    syncFromProps.call(ctx);
    expect(ctx.selectedBucketId).toBe('');
    expect(ctx.selectedField).toBe('');
    expect(ctx.defaultCalls).toBe(1);
  });

  test('carries a custom field across the switch', () => {
    const ctx = makeCtx({
      initialBucketId: 'b',
      initialField: '__custom',
      initialCustomField: 'data.title',
      selectedBucketId: 'b',
      selectedField: 'app',
      customField: '',
    });
    syncFromProps.call(ctx);
    expect(ctx.selectedField).toBe('__custom');
    expect(ctx.customField).toBe('data.title');
  });
});
