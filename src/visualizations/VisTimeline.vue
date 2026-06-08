<template lang="pug">
  div
    div#visualization

    div.small.text-muted.my-2(v-if="bucketsFromEither.length != 1")
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

  .vis-tooltip {
    // Position tooltip above the cursor instead of overlapping the timeline bars
    transform: translateY(-100%);
    margin-top: -15px;
    // Ensure tooltip is readable
    max-width: 400px;
    pointer-events: none;
  }

  .vis-labelset .vis-label .vis-inner {
    max-width: 250px;
    overflow: visible;
    text-overflow: initial;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.2;
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
import { getCategoryColorFromEvent, getTitleAttr } from '../util/color';
import { getSwimlane } from '../util/swimlane.js';
import { IEvent } from '../util/interfaces';
import { formatTimelineBucketLabelHtml, shortenBucketLabel } from '../util/timelineLabels';

import { Timeline } from 'vis-timeline/esnext';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import EventEditor from '~/components/EventEditor.vue';

let isAlertWarningShown = false;
const PIXELS_PER_WHEEL_LINE = 40;
const PIXELS_PER_WHEEL_PAGE = 800;

interface IChartDataItem {
  bucketId: string;
  title: string;
  tooltip: string;
  start: Date;
  end: Date;
  color: string;
  event: IEvent;
  swimlane: string;
}
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
    swimlane: { type: String },
    updateTimelineWindow: { type: Boolean },
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
          overflowMethod: 'flip',
          delay: 0,
        },
        // Keep vertical wheel input as zoom-only. Without preferZoom, vis-timeline
        // zooms around the cursor and then pans the same wheel event when
        // horizontalScroll is enabled, which makes the zoom anchor drift.
        preferZoom: true,
        // Horizontal scroll navigation (see #629). Dominant horizontal wheel
        // events are handled by onHorizontalWheel.
        horizontalScroll: true, // horizontal scroll/swipe pans the timeline
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
    chartData(): IChartDataItem[] {
      const data: IChartDataItem[] = [];
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
          data.push({
            bucketId: bucket.id,
            title: getTitleAttr(bucket, e),
            tooltip: buildTooltip(bucket, e),
            start: new Date(e.timestamp),
            end: new Date(moment(e.timestamp).add(e.duration, 'seconds').valueOf()),
            color: getCategoryColorFromEvent(bucket, e),
            event: e,
            swimlane: getSwimlane(bucket, e.color, this.swimlane, e),
          });
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
      el.addEventListener('wheel', this.onHorizontalWheel, {
        capture: true,
        passive: false,
      });
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
  beforeDestroy() {
    const el = this.$el.querySelector('#visualization');
    if (el) {
      el.removeEventListener('wheel', this.onHorizontalWheel, { capture: true });
    }
  },
  methods: {
    onHorizontalWheel: function (event: WheelEvent) {
      if (!this.timeline || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }

      const currentWindow = this.timeline.getWindow();
      const start = currentWindow.start.valueOf();
      const end = currentWindow.end.valueOf();
      let deltaX = event.deltaX;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        deltaX *= PIXELS_PER_WHEEL_LINE;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        deltaX *= PIXELS_PER_WHEEL_PAGE;
      }
      const diff = (deltaX / 120) * ((end - start) / 20);

      this.timeline.setWindow(new Date(start + diff), new Date(end + diff), {
        animation: false,
      });
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    openEditor: function () {
      this.$bvModal.show('edit-modal-' + this.editingEvent.id);
    },
    onSelect: async function (properties) {
      if (properties.items.length == 0) {
        return;
      } else if (properties.items.length == 1) {
        const event = this.chartData[properties.items[0]].event;
        const groupId = this.items[properties.items[0]].group;
        // Use group.id (not group.content) — content is '' when showRowLabels=false
        const bucketId = _.find(this.groups, g => g.id == groupId).id;

        // Skip editing if event has no ID (e.g. merged query results) or bucket is a placeholder
        if (!event.id || !bucketId || bucketId === 'events' || bucketId === 'search') {
          console.log(
            'Event has no ID or bucket is a placeholder, skipping editor',
            event,
            bucketId
          );
          return;
        }

        // We retrieve the full event to ensure if's not cut-off by the query range
        // See: https://github.com/ActivityWatch/aw-webui/pull/320#issuecomment-1056921587
        this.editingEvent = await this.$aw.getEvent(bucketId, event.id);
        this.editingEventBucket = bucketId;

        this.$nextTick(() => {
          console.log('Editing event', event, ', in bucket', bucketId);
          this.openEditor();
        });
        if (!isAlertWarningShown) {
          // Show a one-time inline toast instead of a blocking alert(),
          // which fired on top of the editor and rudely interrupted the
          // edit flow. Persist the dismissal via localStorage so the user
          // doesn't see it every session.
          if (!this.editRefreshHintDismissed()) {
            this.$bvToast.toast('Your edit is saved. Refresh the timeline to see it reflected.', {
              title: 'Heads up',
              variant: 'info',
              autoHideDelay: 6000,
              solid: true,
            });
            this.markEditRefreshHintDismissed();
          }
          isAlertWarningShown = true;
        }
      } else {
        alert('selected multiple items: ' + JSON.stringify(properties.items));
      }
    },
    abbreviateBucketName(bucketId: string): string {
      // Kept for callers that don't know about multi-host. update() builds
      // labels directly via formatTimelineBucketLabelHtml so it can pass
      // the multi-host hint.
      return formatTimelineBucketLabelHtml(bucketId);
    },
    editRefreshHintDismissed(): boolean {
      try {
        return localStorage.getItem('aw.timeline.editRefreshHintDismissed') === '1';
      } catch (e) {
        return false;
      }
    },
    markEditRefreshHintDismissed(): void {
      try {
        localStorage.setItem('aw.timeline.editRefreshHintDismissed', '1');
      } catch (e) {
        /* localStorage disabled — fine, fall back to the in-memory flag */
      }
    },
    ensureUpdate() {
      // Will only run update() if data available and never ran before
      if (!this.updateHasRun) {
        this.update();
      }
    },
    update() {
      // Guard against the buckets/events watch firing before mounted's
      // $nextTick has constructed the vis Timeline. Otherwise revisiting
      // the route with the keep-alive cache cleared throws
      // "can't access property setData, this.timeline is null".
      if (!this.timeline) return;

      // Used by unsureUpdate to check if ran
      this.updateHasRun = true;

      // Build groups
      const buckets = this.bucketsFromEither;

      // Decide whether to surface hostnames on labels. We do it
      // all-or-nothing: if ANY two host-attributed buckets share the same
      // shortened label (e.g. two "window" buckets on different hosts),
      // every host-attributed row gets the "@ host" suffix for
      // consistency. Buckets without a real hostname (stopwatch /
      // aw-watcher-web-*, which aren't per-host yet — see
      // https://github.com/ActivityWatch/activitywatch/issues/ for
      // host attribution of these watchers) are always shown bare.
      // TODO: drop the hostnameless-exception branch once
      // stopwatch/browser buckets are migrated to per-host ids.
      const realHost = (b: any): string | undefined => {
        const h = b && (b.hostname || (b.data && b.data.hostname));
        return h && h !== 'unknown' ? h : undefined;
      };
      const labelCounts: Record<string, number> = {};
      _.each(buckets, b => {
        if (b && b.id && realHost(b)) {
          const short = shortenBucketLabel(b.id) || b.id;
          labelCounts[short] = (labelCounts[short] || 0) + 1;
        }
      });
      const hasCollision = _.some(labelCounts, c => c > 1);

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
        let label = '';
        if (this.showRowLabels) {
          const host = realHost(bucket);
          label = formatTimelineBucketLabelHtml(bucket.id, {
            hostname: hasCollision && host ? host : undefined,
          });
        }
        return { id: bucket.id, content: label };
      });

      // Build items
      const items = _.map(this.chartData, (item, i) => {
        const bgColor = item.color;
        const borderColor = Color(bgColor).darken(0.3);
        return {
          id: String(i),
          group: item.bucketId,
          content: item.title,
          title: item.tooltip,
          start: moment(item.start),
          end: moment(item.end),
          style: `background-color: ${bgColor}; border-color: ${borderColor}`,
          subgroup: item.swimlane,
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
            subgroup: ``,
          });
        }

        if (this.updateTimelineWindow) {
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
        }

        // Hide buckets with no events in the queried range
        const count = _.countBy(items, i => i.group);
        groups = _.filter(groups, g => {
          return count[g.id] && count[g.id] > 0;
        });
        this.timeline.setData({ groups: groups, items: items });

        this.items = items;
        this.groups = groups;
      } else {
        // update the timeline range (only if a queried interval is provided;
        // some callers like the Bucket detail view don't pass one)
        if (this.queriedInterval) {
          this.options.min = this.queriedInterval[0];
          this.options.max = this.queriedInterval[1];
          this.timeline.setOptions(this.options);
          this.timeline.setWindow(this.queriedInterval[0], this.queriedInterval[1]);
        }

        // clear the data
        this.timeline.setData({ groups: [], items: [] });
        this.items = [];
        this.groups = [];
      }
    },
  },
};
</script>
