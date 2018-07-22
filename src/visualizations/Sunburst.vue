<template lang="pug">
div.sunburst
  div.sidebar
    div.legend

  div.main
    div.chart
      div.explanation
        div.base
          | {{ centerMsg }}
        div.hover(style="visibility: hidden")
          div.date
          div.title
          div.time
          div.duration
          div.data(style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;")
</template>

<style scoped lang="scss">
.sunburst {
  font-family: 'Open Sans', sans-serif;
  font-size: 12px;
  font-weight: 400;
  width: 100%;
  height: 620px;
  margin-top: 10px;

  .main {
    width: 750px;
    margin-right: auto;
    margin-left: auto;
  }

  .sidebar {
    float: right;
    height: 0;
    width: 100px;
  }

  .sequence {
    width: 600px;
    height: 70px;
  }

  .legend {
    padding: 10px 0 0 3px;
  }

  .sequence text, .legend text {
    font-weight: 600;
    fill: #fff;
  }

  .chart {
    position: relative;
  }

  .chart path {
    stroke: #fff;
  }

  .explanation {
    position: absolute;
    top: 260px;
    left: 305px;
    width: 140px;
    text-align: center;
    color: #666;
    z-index: 10; // might not be needed

    .base {
        color: #DDD;
        font-size: 2em;
    }

    .hover {
      .date {
        font-size: 0.8em;
      }

      .time {
        font-size: 1em;
      }

      .title {
        font-size: 2em;
        font-weight: bold;
      }

      .duration {
        font-size: 1em;
      }

      .data {
        font-size: 1em;
      }
    }
  }
}
</style>

<script>
// NOTE: This is just a Vue.js component wrapper for timeline-simple.js
//       Code should generally go in the framework-independent file.

// TODO: Sunburst requires a hierarchical data format

import sunburst from './sunburst.js';
import moment from 'moment';
import coloring_types from './coloring.js';

import awclient from '../awclient.js';

let aw_sunburst = {
  name: "aw-sunburst",
  props: ['date', 'afkBucketId', 'windowBucketId'],
  mounted: function() {
    console.log("Mounting aw-sunburst");
    sunburst.create(this.$el);
    this.starttime = moment(this.date);
    this.endtime = moment(this.date).add(1, 'days');
    this.visualize();
  },

  data: () => {
    return {
      starttime: moment(),
      endtime: moment(),
      centerMsg: "Loading...",
    }
  },

  watch: {
    "date": function(to, from) {
      this.starttime = moment(to);
      this.endtime = moment(this.starttime).add(1, 'days');
      this.visualize();
    }
  },

  methods: {
    todaysEvents: function(bucket_id) {
      return awclient.getEvents(bucket_id, {
        limit: -1,
        start: this.starttime.format(), end: this.endtime.format()
      }).then(res => res.data);
    },

    visualize: function() {
      function buildHierarchy(parents, children) {
          parents = _.sortBy(parents, "timestamp", "desc");
          children = _.sortBy(children, "timestamp", "desc");

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
          //console.log(parents);
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
                  //console.log(new_events[p_i].duration);
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

      this.todaysEvents(this.afkBucketId).then((events_afk) => {
        this.todaysEvents(this.windowBucketId).then((events_window) => {
          let hierarchy = null;
          if(events_afk.length > 0 && events_window.length > 0) {
            hierarchy = buildHierarchy(events_afk, events_window);
            this.centerMsg = "Hover to inspect";
          } else {
            // FIXME: This should do the equivalent of "No data" when such is the case, but it doesn't.
            hierarchy = {
              "timestamp": "",
              // TODO: If we want a 12/24h clock, this has to change
              "duration": 0,
              "data": {"title": "ROOT"},
              "children": []
            };
            this.centerMsg = "No data";
          }
          sunburst.update(this.$el, hierarchy);
        });
      });
    },
  },
}

export default aw_sunburst;
</script>
