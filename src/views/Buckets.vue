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
  b-card.bucket-card(v-for="bucket in buckets", :key="bucket.id", :header="bucket.id")
    b-button-toolbar.float-left
      b-button-group(size="sm", class="mx-1")
        b-button(variant="primary", :to="'/buckets/' + bucket.id")
          | Open bucket
      b-button-group(size="sm", class="mx-1")
        // TODO: This currently does not export bucket metadata, which makes importing difficult
        //       See: https://github.com/ActivityWatch/activitywatch/issues/103
        // NOTE: When this is done we should also change the download name from "events-export" to "bucket-export".
        b-button(:href="'/api/0/buckets/' + bucket.id + '/events?limit=-1'",
                 :download="'aw-event-export-' + bucket.id + '.json'",
                 title="Export all events from this bucket to JSON",
                 variant="outline-secondary")
          | Export as JSON
    b-button-toolbar.float-right
      b-button-group(size="sm", class="mx-1")
        b-button(v-on:click="bucket_to_delete = bucket.id"
                 title="Export all events from this bucket to JSON",
                 variant="outline-danger")
          | #[icon(name="trash")] Delete bucket
    small.bucket-last-updated(v-if="bucket.last_updated", slot="footer")
      span
        | Last updated:
      span(style="width: 8em; margin-left: 0.5em; display: inline-block")
        | {{ bucket.last_updated | friendlytime }}

</template>

<style lang="scss">
// This won't work if scoped
.bucket-card {
  .card-header, .card-footer {
    padding: 0.5em 0.75em 0.5em 0.75em;
  }

  .card-body {
    padding: 0.5em;
  }
}
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

import awclient from '../awclient.js';

export default {
  name: "Buckets",
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
