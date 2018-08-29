<template lang="pug">
div
  h2 Timeline

  input-daterange(v-model="duration")

  hr

  div(v-show="buckets !== null")
    div
      div(style="float: left")
        | Events shown:  {{ num_events }}
      div(style="float: right; color: #999")
        | Drag and scroll to pan and zoom.
    div(style="clear: both")
    vis-timeline(:buckets="buckets", showRowLabels=true)
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
      duration: 1 * 60 * 60,
    }
  },
  watch: {
    duration() {
      this.getBuckets();
    }
  },
  computed: {
    num_events() {
      return _.sumBy(this.buckets, "events.length");
    },
    queried_interval_bucket() {
      let now = moment().add(2, 'minutes');
      return {
        "id": "$queried_interval",
        "type": "test",
        events: [{
          "duration": this.duration,
          "timestamp": moment(now).subtract(this.duration, 'seconds'),
          "data": { "title": "a queried interval" },
        }]
      }
    }
  },
  methods: {
    getBuckets: async function() {
      let now = moment().add(2, 'minutes');
      this.buckets = await this.$aw.getBuckets()
      this.buckets = await Promise.all(_.map(this.buckets, async (bucket) => {
        bucket.events = await this.$aw.getEvents(bucket.id, {end: now.format(), start: moment(now).subtract(this.duration, 'seconds').format(), limit: -1});
        return bucket;
      }));
      this.buckets.push(this.queried_interval_bucket);
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
