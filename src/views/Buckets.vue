<template lang="pug">
div
  h2 Buckets

  b-alert(variant="danger" :show="bucket_to_delete.length > 0")
    | Are you sure you want to delete bucket {{bucket_to_delete}}? (This is permanent and cannot be undone)
    b-button-toolbar
      b-button-group(size="sm", class="mx-1")
        b-button(@click="deleteBucket(bucket_to_delete); bucket_to_delete = ''"
                 title="Confirm",
                 variant="danger")
          | Confirm
        b-button(@click="bucket_to_delete = ''"
                 title="Abort",
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
          icon(name="folder-open")
          | Open bucket
      b-button-group(size="sm", class="mx-1")
        b-button(:href="$aw.baseURL + '/api/0/buckets/' + bucket.id + '/export'",
                 :download="'aw-bucket-export-' + bucket.id + '.json'",
                 title="Export bucket to JSON",
                 variant="outline-secondary")
          icon(name="download")
          | Export as JSON
    b-button-toolbar.float-right
      b-button-group(size="sm", class="mx-1")
        b-button(@click="bucket_to_delete = bucket.id"
                 title="Delete this bucket permanently",
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
import 'vue-awesome/icons/download';
import 'vue-awesome/icons/folder-open';
import _ from 'lodash';

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
    getBuckets: async function() {
      this.buckets = _.orderBy(await this.$aw.getBuckets(), [(b) => b.id], ["asc"]);
    },

    getBucketInfo: async function(bucket_id) {
      this.buckets[bucket_id] = await this.$aw.getBucket(bucket_id);
    },

    deleteBucket: async function(bucket_id) {
      console.log("Deleting bucket " + bucket_id);
      await this.$aw.deleteBucket(bucket_id);
      await this.getBuckets();
    }
  }
}
</script>
