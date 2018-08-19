<template lang="pug">
div
  h2 Buckets

  b-alert(variant="danger" :show="bucket_to_delete.length > 0")
    | Are you sure you want to delete bucket {{bucket_to_delete}}? (This is permanent and cannot be undone)
    b-button-toolbar
      b-button-group(size="sm", class="mx-1")
        b-button(v-on:click="deleteBucket(bucket_to_delete); bucket_to_delete = ''"
                 title="Export all events from this bucket to JSON",
                 variant="danger")
          | Confirm
        b-button(v-on:click="bucket_to_delete = ''"
                 title="Export all events from this bucket to JSON",
                 variant="success")
          | Abort

  b-alert(show)
    | Are you looking to collect more data? Check out #[a(href="https://activitywatch.readthedocs.io/en/latest/watchers.html") the docs] for more watchers.
    br
    small #[b Note:] This is currently not as easy as we want it to be, so some familiarity with programming is currently needed to run most of them.

  //b-card-group(columns=true)
  v-card.mb-2(v-for="bucket in buckets", :key="bucket.id")
    v-card-title(primary-title)
      h3.headline {{ bucket.id }}
      small.grey--text(v-if="bucket.last_updated")
        | Last updated: {{ bucket.last_updated | friendlytime }}
    v-card-actions
      v-btn(flat small :to="'/buckets/' + bucket.id")
        icon(name="folder-open")
        | Open bucket
      // TODO: This currently does not export bucket metadata, which makes importing difficult
      //       See: https://github.com/ActivityWatch/activitywatch/issues/103
      // NOTE: When this is done we should also change the download name from "events-export" to "bucket-export".
      v-btn(flat small :href="'/api/0/buckets/' + bucket.id + '/events?limit=-1'",
               :download="'aw-event-export-' + bucket.id + '.json'",
               title="Export all events from this bucket to JSON",
               variant="outline-secondary")
        icon(name="download")
        | Export as JSON
      v-btn(flat small v-on:click="bucket_to_delete = bucket.id"
               title="Export all events from this bucket to JSON",
               variant="outline-danger")
        | #[icon(name="trash")] Delete bucket

</template>

<style lang="scss">
</style>

<style scoped lang="scss">
.bucket-card {
  margin-bottom: 1em;
}

.bucket-last-updated {
  color: #666;
}
</style>

<script>
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/download';
import 'vue-awesome/icons/folder-open';

import awclient from '../awclient.js';

export default {
  name: 'Buckets',
  mounted: function() {
    this.getBuckets();
  },
  data: () => {
    return {
      buckets: [],
      bucket_to_delete: "",
    }
  },
  methods: {
    getBuckets: function() {
      awclient.getBuckets().then((response) => {
        let buckets = response.data;
        buckets = _.orderBy(buckets, [(b) => b.last_updated], ["desc"]);
        this.buckets = buckets;
      });
    },

    getBucketInfo: function(bucket_id) {
      awclient.getBucket(bucket_id).then((response) => {
        this.buckets[bucket_id] = response.data;
      });
    },

    deleteBucket: function(bucket_id) {
      console.log("Deleting bucket " + bucket_id);
      awclient.deleteBucket(bucket_id).then((response) => {
        this.getBuckets();
      });
    }
  }
}
</script>
