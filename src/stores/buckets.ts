import _ from 'lodash';

import { IBucket } from '~/util/interfaces';
import { defineStore } from 'pinia';
import { getClient } from '~/util/awclient';

function select_buckets(buckets: IBucket[], { host, type }: { host?: string; type?: string }) {
  return _.map(
    _.filter(
      buckets,
      bucket => (!type || bucket['type'] === type) && (!host || bucket['hostname'] == host)
    ),
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

    available(): (hostname: string) => {
      window: boolean;
      browser: boolean;
      editor: boolean;
      android: boolean;
      category: boolean;
    } {
      // Returns a map of which kinds of buckets are available
      //
      // 'window' requires ((currentwindow + afkstatus) or android) buckets
      // 'browser' requires (currentwindow + afk + browser) buckets
      // 'editor' requires editor buckets
      return hostname => {
        const windowAvail =
          this.bucketsWindow(hostname).length > 0 && this.bucketsAFK(hostname).length > 0;
        const androidAvail = this.bucketsAndroid(hostname).length > 0;

        return {
          window: windowAvail,
          browser: window && this.bucketsBrowser(hostname).length > 0,
          editor: this.bucketsEditor(hostname).length > 0,
          android: androidAvail,
          category: windowAvail || androidAvail,
        };
      };
    },

    // These should be considered low-level, and should be used sparingly.
    bucketsAFK() {
      return (host: string) => select_buckets(this.buckets, { host, type: 'afkstatus' });
    },
    bucketsWindow() {
      return (host: string) =>
        _.filter(
          select_buckets(this.buckets, { host, type: 'currentwindow' }),
          id => !id.startsWith('aw-watcher-android')
        );
    },
    bucketsAndroid() {
      return (host: string) =>
        _.filter(select_buckets(this.buckets, { host, type: 'currentwindow' }), id =>
          id.startsWith('aw-watcher-android')
        );
    },
    bucketsEditor() {
      // fallback to a bucket with 'unknown' host, if one exists.
      // TODO: This needs a fix so we can get rid of this workaround.
      const type = 'app.editor.activity';
      return (host: string) => {
        const buckets = select_buckets(this.buckets, { host, type });
        return buckets.length == 0
          ? select_buckets(this.buckets, { host: 'unknown', type })
          : buckets;
      };
    },
    bucketsBrowser() {
      // fallback to a bucket with 'unknown' host, if one exists.
      // TODO: This needs a fix so we can get rid of this workaround.
      const type = 'web.tab.current';
      return (host: string) => {
        const buckets = select_buckets(this.buckets, { host, type });
        return buckets.length == 0
          ? select_buckets(this.buckets, { host: 'unknown', type })
          : buckets;
      };
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
