// initial state
const _state = {
  buckets: [],
};

// getters
const getters = {
  async browserBuckets(state) {
    return _.map(
      _.filter(state.buckets, bucket => bucket['type'] === 'web.tab.current'),
      bucket => bucket['id']
    );
  },
};

// actions
const actions = {
  async loadBuckets({ commit }) {
    const buckets = await this._vm.$aw.getBuckets();
    console.info(`Received buckets ${buckets}`);
    commit('update_buckets', buckets);
  },

  async deleteBucket({ dispatch }, { bucketId }) {
    console.log(`Deleting bucket ${bucketId}`);
    await this._vm.$aw.deleteBucket(bucketId);
    await dispatch('loadBuckets');
  },
};

// mutations
const mutations = {
  update_buckets(state, buckets) {
    state.buckets = buckets;
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
