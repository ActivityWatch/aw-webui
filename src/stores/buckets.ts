import _ from 'lodash';

import { IBucket } from '~/util/interfaces';
import { defineStore } from 'pinia';
import { getClient } from '~/util/awclient';

function get_buckets_by_type(buckets: IBucket[], type: string) {
  return _.map(
    _.filter(buckets, bucket => bucket['type'] === type),
    bucket => bucket['id']
  );
}

function get_buckets_by_host_and_type(buckets: IBucket[], host: string, type: string) {
  return _.map(
    _.filter(buckets, bucket => bucket['type'] === type && bucket['hostname'] == host),
    bucket => bucket['id']
  );
}

export const useBucketsStore = defineStore('buckets', {
  state: () => ({
    buckets: [],
  }),

  getters: {
    hosts() {
      // TODO: Include consideration of device_id UUID
      return _.uniq(_.map(this.buckets, bucket => bucket['hostname']));
    },
    // Uses device_id instead of hostname
    devices() {
      // TODO: Include consideration of device_id UUID
      return _.uniq(_.map(this.buckets, bucket => bucket['device_id']));
    },
    afkBucketsByHost() {
      return host => get_buckets_by_host_and_type(this.buckets, host, 'afkstatus');
    },
    windowBucketsByHost() {
      return host =>
        _.filter(
          get_buckets_by_host_and_type(this.buckets, host, 'currentwindow'),
          id => !id.startsWith('aw-watcher-android')
        );
    },
    androidBucketsByHost() {
      return host =>
        _.filter(get_buckets_by_host_and_type(this.buckets, host, 'currentwindow'), id =>
          id.startsWith('aw-watcher-android')
        );
    },
    editorBuckets() {
      return get_buckets_by_type(this.buckets, 'app.editor.activity');
    },
    browserBuckets() {
      return get_buckets_by_type(this.buckets, 'web.tab.current');
    },
    getBucket() {
      return id => _.filter(this.buckets, b => b.id === id)[0];
    },
    bucketsByHostname() {
      return _.groupBy(this.buckets, 'hostname');
    },
    getHostnames() {
      return _.map(this.buckets, 'hostname');
    },
  },

  actions: {
    async ensureLoaded() {
      if (this.buckets.length === 0) {
        await this.loadBuckets();
      }
    },

    async loadBuckets() {
      const buckets = await getClient().getBuckets();
      this.update_buckets(buckets);
    },

    async getBucketWithEvents({ id, start, end }) {
      await this.ensureLoaded();
      const bucket = _.cloneDeep(this.getBucket(id));
      bucket.events = await getClient().getEvents(bucket.id, {
        start,
        end,
        limit: -1,
      });
      return bucket;
    },

    async getBucketsWithEvents({ start, end }) {
      await this.ensureLoaded();
      const buckets = await Promise.all(
        _.map(
          this.buckets,
          async bucket => await this.getBucketWithEvents({ id: bucket.id, start, end })
        )
      );
      return _.orderBy(buckets, [b => b.id], ['asc']);
    },

    async deleteBucket({ bucketId }) {
      console.log(`Deleting bucket ${bucketId}`);
      await getClient().deleteBucket(bucketId);
      await this.loadBuckets();
    },

    // mutations
    update_buckets(buckets) {
      this.buckets = buckets;
    },
  },
});
