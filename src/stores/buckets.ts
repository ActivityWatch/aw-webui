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

    availableByHost(): (hostname: string) => {
      window: boolean;
      browser: boolean;
      editor: boolean;
    } {
      // Returns a map of which kinds of buckets are available
      //
      // 'window' requires ((currentwindow + afkstatus) or android) buckets
      // 'browser' requires (currentwindow + afk + browser) buckets
      // 'editor' requires editor buckets
      return hostname => {
        const windowAvailable =
          this.windowBucketsByHost(hostname).length > 0 &&
          this.afkBucketsByHost(hostname).length > 0;

        return {
          window: windowAvailable,
          browser: windowAvailable && this.browserBuckets(hostname).length > 0,
          editor: this.editorBuckets(hostname).length > 0,
        };
      };
    },

    availablePerHost(): {
      [hostname: string]: { window: boolean; browser: boolean; editor: boolean };
    } {
      // Returns a map {hostname: {[eg. window, browser, editor]: boolean}} that contains available bucket types for all hosts
      // So we want to map over the hosts, and let the values be the result of the availableByHost function for each host.
      return Object.assign({}, ...this.hosts().map(this.availableByHost()));
    },

    // These should be considered low-level, and should be used sparingly.
    afkBucketsByHost() {
      return (host: string) => get_buckets_by_host_and_type(this.buckets, host, 'afkstatus');
    },
    windowBucketsByHost() {
      return (host: string) =>
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
      // fallback to a bucket with 'unknown' host, if one exists.
      // TODO: This needs a fix so we can get rid of this workaround.
      return (host: string) =>
        get_buckets_by_host_and_type(this.buckets, host, 'app.editor.activity') ||
        get_buckets_by_host_and_type(this.buckets, 'unknown', 'app.editor.activity');
    },
    browserBuckets() {
      // fallback to a bucket with 'unknown' host, if one exists.
      // TODO: This needs a fix so we can get rid of this workaround.
      return (host: string) =>
        get_buckets_by_host_and_type(this.buckets, host, 'web.tab.current') ||
        get_buckets_by_host_and_type(this.buckets, 'unknown', 'web.tab.current');
    },
    getBucket() {
      return (id: string) => _.filter(this.buckets, b => b.id === id)[0];
    },
    bucketsByHostname() {
      return _.groupBy(this.buckets, 'hostname');
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
