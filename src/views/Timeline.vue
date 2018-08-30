<template lang="pug">
div
  h2 Timeline

  input-timeinterval(v-model="daterange")

  div(v-show="buckets !== null")
    div
      div(style="float: left")
        | Events shown:  {{ num_events }}
      div(style="float: right; color: #999")
        | Drag to pan and scroll to zoom.
    div(style="clear: both")
    vis-timeline(:buckets="buckets", showRowLabels=true, :queriedInterval="daterange")
  div(v-show="!(buckets !== null && num_events)")
    h1 Loading...
</template>

<script>
import moment from 'moment';
import _ from 'lodash';

export default {
  name: "Timeline",
  mounted: function() {
    this.getBuckets();
  },
  data: () => {
    return {
      buckets: null,
      daterange: [moment().subtract(1, "hour"), moment()],
    }
  },
  watch: {
    daterange() {
      this.getBuckets();
    }
  },
  computed: {
    num_events() {
      return _.sumBy(this.buckets, "events.length");
    },
  },
  methods: {
    getBuckets: async function() {
      this.buckets = await this.$aw.getBuckets()
      this.buckets = await Promise.all(_.map(this.buckets, async (bucket) => {
        bucket.events = await this.$aw.getEvents(bucket.id, {
          start: this.daterange[0].format(),
          end: this.daterange[1].format(),
          limit: -1
        });
        return bucket;
      }));
      this.buckets = _.orderBy(this.buckets, [(b) => b.id], ["asc"]);
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
