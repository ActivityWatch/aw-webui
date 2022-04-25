const _ = require('lodash');

// initial state
const state = {
  buckets: [],
};

function get_buckets_by_type(buckets, type) {
  return _.map(
    _.filter(buckets, bucket => bucket['type'] === type),
    bucket => bucket['id']
  );
}

function get_buckets_by_host_and_type(buckets, host, type) {
  return _.map(
    _.filter(buckets, bucket => bucket['type'] === type && bucket['hostname'] == host),
    bucket => bucket['id']
  );
}

// getters
const getters = {
  hosts: state => {
    // TODO: Include consideration of device_id UUID
    return _.uniq(_.map(state.buckets, bucket => bucket['hostname']));
  },
  // Uses device_id instead of hostname
  devices: state => {
    // TODO: Include consideration of device_id UUID
    return _.uniq(_.map(state.buckets, bucket => bucket['device_id']));
  },
  afkBucketsByHost: state => host => {
    return get_buckets_by_host_and_type(state.buckets, host, 'afkstatus');
  },
  windowBucketsByHost: state => host => {
    return _.filter(
      get_buckets_by_host_and_type(state.buckets, host, 'currentwindow'),
      id => !id.startsWith('aw-watcher-android')
    );
  },
  androidBucketsByHost: state => host => {
    return _.filter(get_buckets_by_host_and_type(state.buckets, host, 'currentwindow'), id =>
      id.startsWith('aw-watcher-android')
    );
  },
  editorBuckets(state) {
    return get_buckets_by_type(state.buckets, 'app.editor.activity');
  },
  browserBuckets(state) {
    return get_buckets_by_type(state.buckets, 'web.tab.current');
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
    commit('update_buckets', buckets);
  },

  async getBucketWithEvents({ getters, dispatch }, { id, start, end }) {
    await dispatch('ensureBuckets');
    const bucket = _.cloneDeep(getters.getBucket(id));
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
