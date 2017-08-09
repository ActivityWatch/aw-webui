<template lang="pug">
div
  h2 Buckets

  b-alert(show)
    | Are you looking to collect more data? Check out #[a(href="https://activitywatch.readthedocs.io/en/latest/watchers.html") the docs] for more watchers.
    br
    small #[b Note:] This is currently not as easy as we want it to be, so some familiarity with programming is currently needed to run most of them.

  //b-card-group(columns=true)
  b-card.bucket-card(v-for="bucket in buckets", :key="bucket.id", :header="bucket.id")
    b-button-toolbar
      b-button-group(size="sm", class="mx-1")
        b-button(variant="primary", :to="'/buckets/' + bucket.id")
          | Open bucket
      b-button-group(size="sm", class="mx-1")
        b-button(:href="'/api/0/buckets/' + bucket.id + '/events?limit=-1'", title="Export all events from this bucket to JSON")
          | Export as JSON
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

  .card-block {
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
