<template lang="pug">

div
  h3 Today

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
    }
  },
  methods: {
    getBucketInfo: function(bucket_id) {
      return $Bucket.get({"id": bucket_id}).then((response) => {
        return response.json();
      });
    },

    getEvents: function(bucket_id) {
      return $Event.get({"id": bucket_id}).then((response) => {
        return response.json();
      });
    }
  },
  mounted: function() {
    // TODO: ONLY FOR TESTING
    let bucket_id_afk = "aw-watcher-afk-testing_erb-main2-arch";
    let bucket_id_window = "aw-watcher-window-testing_erb-main2-arch";

    function buildHierarchy(parents, children) {
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
                let within_parent = e_end.isBefore(p_end);

                // TODO: This isn't correct, yet
                if(too_far) {
                  // Events are ahead
                  console.log("Too far ahead: " + i_child);
                  break;
                } else if(within_parent /*&& p2 && p3*/) {
                  console.log("Added relation: " + i_child);
                  p.children = _.concat(p.children, e);
                  i_child++;
                } else {
                  // Events are behind
                  console.log("Too far behind: " + i_child);
                  i_child++;
                }
            }
        }

        // Build the root node
        let m_start = moment(_.first(parents).timestamp)
        let m_end = moment(_.tail(parents).timestamp)
        return {
          "timestamp": _.first(parents).timestamp,
          "duration": moment.duration(m_end.diff(m_end)).asSeconds(),
          "data": {"title": "ROOT"},
          "children": parents
        }

    }

    this.getEvents(bucket_id_afk).then((events_afk) => {
        console.log(events_afk);
        return this.getEvents(bucket_id_window).then((events_window) => {
            return buildHierarchy(events_afk, events_window);
        });
    }).then((hierarchy) => {
        console.log(hierarchy);
        this.hierarchy = hierarchy;
    });
  },
}
</script>
