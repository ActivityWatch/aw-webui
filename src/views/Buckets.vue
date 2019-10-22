<template lang="pug">
div
  h2 Buckets

  b-alert(show)
    | Are you looking to collect more data? Check out #[a(href="https://activitywatch.readthedocs.io/en/latest/watchers.html") the docs] for more watchers.
    br
    small #[b Note:] This is currently not as easy as we want it to be, so some familiarity with programming is currently needed to run most of them.

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
        b-button(v-b-modal="'delete-modal-' + bucket.id",
                 title="Delete this bucket permanently",
                 variant="outline-danger")
          | #[icon(name="trash")] Delete bucket
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
  br

  h3 Import and export buckets

  b-card-group.deck
    b-card(header="Import buckets")
      form(method="post", :action="$aw.baseURL + '/api/0/import'", enctype="multipart/form-data")
        input(type="file", name="buckets.json")
        input(type="submit", value="Import")
      span
        | A valid file to import is a JSON file from either an export of a single bucket or an export from multiple buckets.
        | If there are buckets with the same name the import will fail
    b-card(header="Export buckets")
      b-button(:href="$aw.baseURL + '/api/0/export'",
               :download="'aw-bucket-export.json'",
               title="Export bucket to JSON",
               variant="outline-secondary")
        icon(name="download")
        | Export all buckets as JSON

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
  computed: {
    buckets: function() {
      return _.orderBy(this.$store.state.buckets.buckets, [(b) => b.id], ["asc"]);
    },
  },
  mounted: async function() {
    await this.$store.dispatch("buckets/ensureBuckets");
  },
  methods: {
    deleteBucket: async function(bucketId) {
      await this.$store.dispatch("buckets/deleteBucket", { bucketId });
      this.$root.$emit('bv::hide::modal','delete-modal-' + bucketId)
    }
  }
}
</script>
