// initial state
const state = {
  buckets: [],
};

// getters
const getters = {
  browserBuckets(state) {
    return _.map(
      _.filter(state.buckets, bucket => bucket['type'] === 'web.tab.current'),
      bucket => bucket['id']
    );
  },
  getBucket: state => id => _.filter(state.buckets, b => b.id === id)[0],
  bucketsByHostname: state => _.groupBy(state.buckets, 'hostname'),
};

// actions
const actions = {
  async ensureBuckets({ state, dispatch }) {
    if (state.buckets.length === 0) {
      await dispatch('loadBuckets');
    }
  },

  async loadBuckets({ commit }) {
    const buckets = await this._vm.$aw.getBuckets();
    console.info('Received buckets: ', buckets);
    commit('update_buckets', buckets);
  },

  async getBucketWithEvents({ getters, dispatch }, { id, start, end }) {
    await dispatch('ensureBuckets');
    const bucket = getters.getBucket(id);
    bucket.events = await this._vm.$aw.getEvents(bucket.id, {
      start,
      end,
      limit: -1,
    });
    return bucket;
  },

  async getBucketsWithEvents({ state, dispatch }, { start, end }) {
    await dispatch('ensureBuckets');
    const buckets = await Promise.all(
      _.map(
        state.buckets,
        async bucket => await dispatch('getBucketWithEvents', { id: bucket.id, start, end })
      )
    );
    return _.orderBy(buckets, [b => b.id], ['asc']);
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
  state: state,
  getters,
  actions,
  mutations,
};
