import store from '~/store';

beforeEach(() => {
  store.commit('views/clearViews');
});

test('load default views', () => {
  expect(store.state.views.views).toHaveLength(0);
  store.dispatch('views/load');
  expect(store.state.views.views).not.toHaveLength(0);
});

test('loads specific views', () => {
  expect(store.state.views.views).toHaveLength(0);
  store.commit('views/loadViews', [{ id: 'something', name: 'Something', elements: [] }]);
  expect(store.state.views.views).not.toHaveLength(0);
});
