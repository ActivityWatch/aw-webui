<template lang="pug">

div
  h3 Today
  p Host: {{ host }}

  b-alert(variant="warning" show)
    | This is an early version. It is known to have issues and lacks basic functionality such as being able to change date.
    br
    | See #[a(href="https://github.com/ActivityWatch/aw-webui/issues/36") issue #36] for details.

  aw-sunburst(:hierarchy="hierarchy")

</template>

<style scoped lang="scss">
</style>

<script>
import moment from "moment";
import Resources from '../resources.js';

import Sunburst from '../visualizations/Sunburst.vue';

let $Bucket = Resources.$Bucket;
let $Event = Resources.$Event;

export default {
  name: "Bucket",
  components: {
    "aw-sunburst": Sunburst,
  },
  data: () => {
    return {
      hierarchy: Object,
      date: ""
    }
  },
  computed: {
    host: function() {
        return this.$route.params.host;
    }
  },
  watch: {
    '$route': function(to, from) {
      this.host = this.$route.params.host;
      this.visualize();
    },
    'host': function() {
      this.visualize();
    }
  },
  mounted: function() {
    this.visualize();
  },
  methods: {
  getBucketInfo: function(bucket_id) {
    return $Bucket.get({"id": bucket_id}).then((response) => {
      return response.json();
    });
  },

  getEvents: function(bucket_id, start, end) {
    let limit = 1000;
    return $Event.get({"id": bucket_id, "start": start, "end": end, "limit": 1000}).then((response) => {
      let events = response.json();
      if(events.length >= limit) {
        console.warn("Reached event limit");
      }
      return events;
    });
  },
  visualize: function() {
    let bucket_id_afk = "aw-watcher-afk_" + this.host;
    let bucket_id_window = "aw-watcher-window_" + this.host;

    if(!PRODUCTION) {
        bucket_id_afk = "aw-watcher-afk-testing_" + this.host;
        bucket_id_window = "aw-watcher-window-testing_" + this.host;
    }

    function buildHierarchy(parents, children) {
        _.sortBy(parents, (o) => o.timestamp);
        _.sortBy(children, (o) => o.timestamp);

        _.reverse(parents);
        _.reverse(children);

        var i_child = 0;
        for(var i_parent = 0; i_parent < parents.length; i_parent++) {
            let p = parents[i_parent];
            let p_start = moment(p.timestamp);
            let p_end = p_start.clone().add(p.duration, "seconds");

            p.children = [];
            while(i_child < children.length) {
                var e = children[i_child];
                var e_start = moment(e.timestamp);
                var e_end = e_start.clone().add(e.duration, "seconds");

                let too_far = e_start.isAfter(p_end);
                let before_parent = e_end.isBefore(p_start);
                let within_parent = e_start.isAfter(p_start) && e_end.isBefore(p_end);
                let after_parent = e_start.isAfter(p_end);

                // TODO: This isn't correct, yet
                if(before_parent) {
                  // Child is behind parent
                  //console.log("Too far behind: " + i_child);
                  i_child++;
                } else if(within_parent) {
                  //console.log("Added relation: " + i_child);
                  p.children = _.concat(p.children, e);
                  i_child++;
                } else if(after_parent) {
                  // Child is ahead of parent
                  //console.log("Too far ahead: " + i_child);
                  break;
                } else {
                  // TODO: Split events when this happens
                  console.warn("Between parents");
                  p.children = _.concat(p.children, e);
                  i_child++;
                }
            }
        }

        // Build the root node
        console.log(parents);
        let m_start = moment(_.first(parents).timestamp)
        let m_end = moment(_.tail(parents).timestamp)
        let duration = (m_end - m_start) / 1000;
        return {
          "timestamp": _.first(parents).timestamp,
          // TODO: If we want a 12/24h clock, this has to change
          "duration": duration,
          "data": {"title": "ROOT"},
          "children": parents
        }
    }

    function chunkHierarchy(events, key) {
        // TODO: Merge window events with same app and assign the title events as children
        let new_events = [events[0]];
        let p_i = 0;
        _.each(events, (e, i) => {
            if(e.data[key] === new_events[p_i].data[key]) {
                //console.log("merge");
                let e_moment = moment(e.timestamp);
                let ne_moment = moment(new_events[p_i].timestamp);
                new_events[p_i].duration = -e_moment.diff(ne_moment, "seconds", true) + e.duration;
                console.log(new_events[p_i].duration);
            } else {
                //console.log("skip");
                //console.log(new_events[p_i].duration);
                p_i++;
                new_events[p_i] = e;
            }
        });
        _.each(new_events, (e, i) => {
            // Get rid of other keys
            e.data = _.pickBy(e.data, (v, k) => k === key);
        })
        return new_events;
    }

    // TODO: There can currently be a gap after 00:00, we need to "overquery"
    //       to get events that start before 00:00 but end after 00:00
    let now = moment();
    let start = now.clone().startOf('day').subtract(0, "days");
    let end = now.clone().endOf('day');

    // This seems to be needed, for some reason...
    start = start.subtract(start.utcOffset(), "minutes");
    end = end.subtract(end.utcOffset(), "minutes");

    //console.log(start.format());
    //console.log(end.format());

    function chunkHierarchy2(events, key) {
      events = _.sortBy(events, (e) => e.timestamp);
      events = _.reverse(events);
      events = _.reduce(events,
        function(acc, e) {
          let last = _.last(acc);
          if(last.data[key] === e.data[key]) {
            last.duration = moment(e.timestamp).diff(last.timestamp, "seconds", true) + e.duration;
          } else {
            acc.push(e);
          }
          return acc;
        },
        [events[0]]);
      return events;
    }

    this.getEvents(bucket_id_afk, start.format(), end.format()).then((events_afk) => {
        this.getEvents(bucket_id_window, start.format(), end.format()).then((events_window) => {
            //events_afk = _.filter(events_afk, (e) => e.data.status == "not-afk");
            //events_window = _.filter(events_window, (e) => e.duration > 10);

            //events_afk = chunkHierarchy(events_afk, "status");
            //events_window = chunkHierarchy(events_window, "app");
            this.hierarchy = buildHierarchy(events_afk, events_window);
        });
    });
  },
  },
}
</script>
