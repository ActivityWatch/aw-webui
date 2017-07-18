<template lang="jade">
div
  h2 Buckets

  hr

  b-card.bucket-card(v-for="bucket in buckets", :key="bucket.id", :header="bucket.id", :is-open="true")
    b-button-toolbar
      router-link(:to="'/buckets/' + bucket.id")
        b-button
          span.glyphicon.glyphicon-folder-open(aria-hidden="true")
          | Open bucket
      router-link(:to="'/api/0/buckets/' + bucket.id + '/events?limit=-1'")
        b-button
          span.glyphicon.glyphicon-save(aria-hidden="true")
          | Export as JSON
    div.bucket-last-updated(v-if="bucket.last_updated")
      span
        | Last updated:
      span(style="width: 8em; margin-left: 0.5em; display: inline-block")
        | {{ bucket.last_updated | friendlytime }}

</template>

<style scoped lang="scss">

.bucket-card {
  margin-bottom: 1em;
}

.bucket-last-updated{
    margin-top: 0.5em;
    font-size: 10pt;
    color: #666;
}

</style>

<script>
import Resources from '../resources.js';

let $Bucket = Resources.$Bucket;

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
    getBuckets: function() {
      $Bucket.get().then((response) => {
        this.buckets = response.json();
      });
    },

    getBucketInfo: function(bucket_id) {
      $Bucket.get({"id": bucket_id}).then((response) => {
        this.buckets[bucket_id] = response.json();
      });
    }
  }
}
</script>
