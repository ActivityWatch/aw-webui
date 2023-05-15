<template lang="pug">
div
  div#visualization

  div.small.my-2(v-if="bucketsFromEither.length != 1")
    i Buckets with no events in the queried range will be hidden.

  div(v-if="editingEvent")
    EventEditor(:event="editingEvent" :bucket_id="editingEventBucket")
</template>

<style lang="scss">
div#visualization {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  overflow: visible;

  .vis-timeline {
    overflow: visible;
  }

  .timeline-timeline {
    font-family: sans-serif !important;

    .timeline-panel {
      box-sizing: border-box;
    }

    .timeline-item {
      border-radius: 2px;
    }
  }
}
</style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import Color from 'color';
import { buildTooltip } from '../util/tooltip.js';
import { getColorFromString, getTitleAttr } from '../util/color';

import { Timeline } from 'vis-timeline/esnext';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import EventEditor from '~/components/EventEditor.vue';

export default {
  components: {
    EventEditor,
  },
  props: {
    buckets: { type: Array },
    events: { type: Array },
    showRowLabels: { type: Boolean },
    queriedInterval: { type: Array },
    showQueriedInterval: { type: Boolean },
  },
  data() {
    return {
      timeline: null,
      filterShortEvents: true,
      items: [],
      groups: [],
      options: {
        zoomMin: 1000 * 60, // 10min in milliseconds
        zoomMax: 1000 * 60 * 60 * 24 * 31 * 3, // about three months in milliseconds
        stack: false,
        tooltip: {
          followMouse: true,
          overflowMethod: 'cap',
          delay: 0,
        },
      },
      editingEvent: null,
      editingEventBucket: null,

      updateHasRun: false,
    };
  },
  computed: {
    bucketsFromEither() {
      if (this.buckets) {
        return this.buckets;
      } else if (this.events) {
        // If buckets not passed, check if events have been passed and generate a bucket from those events
        return [
          {
            id: 'events',
            type: 'search',
            events: this.events,
          },
        ];
      } else {
        console.error('No buckets or events passed to timeline');
        return [];
      }
    },
    chartData() {
      const data = [];
      _.each(this.bucketsFromEither, bucket => {
        if (bucket.events === undefined) {
          return;
        }
        let events = bucket.events;
        // Filter out events shorter than 1 second (notably including 0-duration events)
        // TODO: Use flooding instead, preferably with some additional method of removing/simplifying short events for even greater performance
        if (this.filterShortEvents) {
          events = _.filter(events, e => e.duration > 1);
          console.log(`Filtered ${bucket.events.length - events.length} events`);
        }
        events.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
        _.each(events, e => {
          data.push([
            bucket.id,
            getTitleAttr(bucket, e),
            buildTooltip(bucket, e),
            new Date(e.timestamp),
            new Date(moment(e.timestamp).add(e.duration, 'seconds').valueOf()),
            getColorFromString(getTitleAttr(bucket, e)),
            e,
          ]);
        });
      });
      return data;
    },
  },
  watch: {
    buckets() {
      // For some reason, an object is passed here, after which the correct array arrives
      if (this.buckets.length === undefined) {
        //console.log("I told you so!")
        return;
      }

      this.update();
    },
    events() {
      if (this.events.length === undefined) {
        return;
      }

      this.update();
    },
  },
  mounted() {
    this.$nextTick(() => {
      const el = this.$el.querySelector('#visualization');
      this.timeline = new Timeline(el, [], [], this.options);
      this.timeline.on('select', properties => {
        // Sends both 'press' and 'tap' events, only one should trigger
        if (properties.event.type == 'tap') {
          this.onSelect(properties);
        }
      });

      this.ensureUpdate();
    });
  },
  methods: {
    openEditor: function () {
      this.$bvModal.show('edit-modal-' + this.editingEvent.id);
    },
    onSelect: async function (properties) {
      if (properties.items.length == 0) {
        return;
      } else if (properties.items.length == 1) {
        const event = this.chartData[properties.items[0]][6];
        const groupId = this.items[properties.items[0]].group;
        const bucketId = _.find(this.groups, g => g.id == groupId).content;

        // We retrieve the full event to ensure if's not cut-off by the query range
        // See: https://github.com/ActivityWatch/aw-webui/pull/320#issuecomment-1056921587
        this.editingEvent = await this.$aw.getEvent(bucketId, event.id);
        this.editingEventBucket = bucketId;

        this.$nextTick(() => {
          console.log('Editing event', event, ', in bucket', bucketId);
          this.openEditor();
        });
        alert(
          "Note: Changes won't be reflected in the timeline until the page is refreshed. This will be improved in a future version."
        );
      } else {
        alert('selected multiple items: ' + JSON.stringify(properties.items));
      }
    },
    ensureUpdate() {
      // Will only run update() if data available and never ran before
      if (!this.updateHasRun) {
        this.update();
      }
    },
    update() {
      // Used by unsureUpdate to check if ran
      this.updateHasRun = true;

      // Build groups
      const buckets = this.bucketsFromEither;
      let groups = _.map(buckets, bucket => {
        // If bucket id is not set, then if only one bucket is given, assume result of a search/query and set a constant placeholder one.
        // Otherwise, log a warning.
        if (bucket.id === undefined) {
          if (buckets.length === 1) {
            bucket.id = 'events';
          } else {
            console.warn(
              'Bucket id is not set, but there are multiple buckets. This is not supported.'
            );
          }
        }
        return { id: bucket.id, content: this.showRowLabels ? bucket.id : '' };
      });

      // Build items
      const items = _.map(this.chartData, (row, i) => {
        const bgColor = row[5];
        const borderColor = Color(bgColor).darken(0.3);
        return {
          id: String(i),
          group: row[0],
          content: row[1],
          title: row[2],
          start: moment(row[3]),
          end: moment(row[4]),
          style: `background-color: ${bgColor}; border-color: ${borderColor}`,
        };
      });

      if (groups.length > 0 && items.length > 0) {
        if (this.queriedInterval && this.showQueriedInterval) {
          const duration = this.queriedInterval[1].diff(this.queriedInterval[0], 'seconds');
          groups.push({ id: String(groups.length), content: 'queried interval' });
          items.push({
            id: String(items.length + 1),
            group: groups.length - 1,
            title: buildTooltip(
              { type: 'test' },
              {
                timestamp: this.queriedInterval[0],
                duration: duration,
                data: { title: 'test' },
              }
            ),
            content: 'query',
            start: this.queriedInterval[0],
            end: this.queriedInterval[1],
            style: 'background-color: #aaa; height: 10px',
          });
        }

        const start =
          (this.queriedInterval && this.queriedInterval[0]) ||
          _.min(_.map(items, item => item.start));
        const end =
          (this.queriedInterval && this.queriedInterval[1]) ||
          _.max(_.map(items, item => item.end));
        this.options.min = start;
        this.options.max = end;
        this.timeline.setOptions(this.options);
        this.timeline.setWindow(start, end);

        // Hide buckets with no events in the queried range
        const count = _.countBy(items, i => i.group);
        groups = _.filter(groups, g => {
          return count[g.id] && count[g.id] > 0;
        });
        this.timeline.setData({ groups: groups, items: items });

        this.items = items;
        this.groups = groups;
      }
    },
  },
};
</script>
