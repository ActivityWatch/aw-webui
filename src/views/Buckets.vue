<template lang="pug">
div
  h2 Buckets

  b-alert(show)
    | Are you looking to collect more data? Check out #[a(href="https://activitywatch.readthedocs.io/en/latest/watchers.html") the docs] for more watchers.
    br
    small #[b Note:] This is currently not as easy as we want it to be, so some familiarity with programming is currently needed to run most of them.

  //b-card-group(columns=true)
  b-card.bucket-card(v-for="bucket in buckets", :key="bucket.id", :header="bucket.id")
    b-button-toolbar.float-left
      b-button.mr-2(variant="primary", :to="'/buckets/' + bucket.id", size="sm")
        icon.ml-0.mr-2(name="folder-open")
        | Open
      b-button(:href="$aw.baseURL + '/api/0/buckets/' + bucket.id + '/export'",
               :download="'aw-bucket-export-' + bucket.id + '.json'",
               title="Export this bucket and all its events as JSON",
               variant="outline-secondary", size="sm")
        icon.ml-0.mr-2(name="download")
        | Export
    b-button-toolbar.float-right
      b-button(v-b-modal="'delete-modal-' + bucket.id", variant="outline-danger", size="sm")
        icon.ml-0.mr-2(name="trash")
        | Delete
    small.bucket-last-updated(v-if="bucket.last_updated", slot="footer")
      span
        | Last updated:
      span(style="width: 8em; margin-left: 0.5em; display: inline-block")
        | {{ bucket.last_updated | friendlytime }}

    b-modal(:id="'delete-modal-' + bucket.id", title="Danger!", centered, hide-footer)
      | Are you sure you want to delete bucket "{{bucket.id}}"?
      br
      br
      b This is permanent and cannot be undone!
      hr
      div.float-right
        b-button.mx-2(@click="$root.$emit('bv::hide::modal','delete-modal-' + bucket.id)")
          | Cancel
        b-button(@click="deleteBucket(bucket.id)", variant="danger")
          | Confirm

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
      this.$root.$emit('bv::hide::modal','delete-modal-' + bucket_id)
    }
  }
}
</script>
