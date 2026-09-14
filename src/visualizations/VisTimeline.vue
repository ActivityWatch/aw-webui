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
import { markRaw } from 'vue';
import Color from 'color';
import { buildTooltip } from '../util/tooltip.js';
import { getCategoryColorFromEvent, getTitleAttr } from '../util/color';
import { getSwimlane } from '../util/swimlane.js';
import {
  indexTimelineEvents,
  visibleTimelineEvents,
  syncTimelineData,
} from '../util/timelineIndex';
import { DataSet } from 'vis-data';
import { formatTimelineBucketLabelHtml, shortenBucketLabel } from '../util/timelineLabels';

import { Timeline } from 'vis-timeline/esnext';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import EventEditor from '~/components/EventEditor.vue';

let isAlertWarningShown = false;
const PIXELS_PER_WHEEL_LINE = 40;
const PIXELS_PER_WHEEL_PAGE = 800;

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
        return this.buckets.map((bucket, i) => ({
          ...bucket,
          id: bucket.id ?? (this.buckets.length === 1 ? 'events' : `bucket-${i}`),
        }));
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
    eventIndex() {
      return indexTimelineEvents(this.bucketsFromEither, this.filterShortEvents);
    },
  },
  watch: {
    swimlane() {
      this.update();
    },
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
  created() {
    this.itemData = new DataSet();
    this.groupData = new DataSet();
    this.itemEvents = new Map();
    this.preparedItems = new Map();
    this.hasInitialRange = false;
    this.viewportFrame = null;
  },
  mounted() {
    this.$nextTick(() => {
      if (this._isDestroyed || this._isBeingDestroyed) return;
      const el = this.$el.querySelector('#visualization');
      el.addEventListener('wheel', this.onHorizontalWheel, {
        capture: true,
        passive: false,
      });
      this.options.tooltip.template = item => item.title || this.tooltipForItem(item.id);
      this.timeline = markRaw(new Timeline(el, this.itemData, this.groupData, this.options));
      this.timeline.on('rangechange', this.scheduleViewportUpdate);
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
    if (this.viewportFrame != null) cancelAnimationFrame(this.viewportFrame);
    this.itemEvents?.clear();
    this.preparedItems?.clear();
    const el = this.$el.querySelector('#visualization');
    if (el) {
      el.removeEventListener('wheel', this.onHorizontalWheel, { capture: true });
    }
    if (this.timeline) {
      this.timeline.destroy();
      this.timeline = null;
    }
  },
  methods: {
    scheduleViewportUpdate() {
      if (this.viewportFrame != null) return;
      this.viewportFrame = requestAnimationFrame(() => {
        this.viewportFrame = null;
        if (this.timeline) this.update(false);
      });
    },
    tooltipForItem(id) {
      if (id === 'queried-interval' && this.queriedInterval) {
        return buildTooltip(
          { type: 'test' },
          {
            timestamp: this.queriedInterval[0],
            duration: this.queriedInterval[1].diff(this.queriedInterval[0], 'seconds'),
            data: { title: 'query' },
          }
        );
      }
      const item = this.itemEvents.get(id);
      return item ? buildTooltip({ ...item.bucket, type: item.bucket.type || '' }, item.event) : '';
    },
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
        const selected = this.itemEvents.get(properties.items[0]);
        if (!selected) return;
        const event = selected.event;
        const bucketId = selected.bucket.id;

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
    update(resetWindow = true) {
      // Guard against the buckets/events watch firing before mounted's
      // $nextTick has constructed the vis Timeline. Otherwise revisiting
      // the route with the keep-alive cache cleared throws
      // "can't access property setData, this.timeline is null".
      if (!this.timeline) return;

      const index = this.eventIndex;
      if (resetWindow && (this.updateTimelineWindow || !this.hasInitialRange)) {
        const start = this.queriedInterval?.[0]?.valueOf() ?? index.entries[0]?.start;
        const end = this.queriedInterval?.[1]?.valueOf() ?? index.ends[index.ends.length - 1];
        if (start !== undefined && end !== undefined) {
          this.hasInitialRange = true;
          this.timeline.setOptions({ min: start, max: end });
          this.timeline.setWindow(start, end, { animation: false });
        }
      }
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

      const timelineWindow = this.timeline.getWindow();
      const start = timelineWindow.start.valueOf();
      const end = timelineWindow.end.valueOf();
      const buffer = (end - start) / 2;
      const visible = visibleTimelineEvents(index, start - buffer, end + buffer);
      this.itemEvents = new Map(visible.map(item => [item.id, item]));
      const colors = new Map();
      const items = visible.map(item => {
        if (!resetWindow && this.preparedItems.has(item.id)) return this.preparedItems.get(item.id);
        const color = getCategoryColorFromEvent(item.bucket, item.event);
        if (!colors.has(color)) colors.set(color, Color(color).darken(0.3).toString());
        return {
          id: item.id,
          group: item.bucket.id,
          content: getTitleAttr(item.bucket, item.event),
          start: item.start,
          end: item.end,
          style: `background-color: ${color}; border-color: ${colors.get(color)}`,
          subgroup: getSwimlane(item.bucket, color, this.swimlane, item.event),
        };
      });

      // Keep group rows stable while panning through gaps in a bucket's data.
      this.preparedItems = new Map(items.map(item => [item.id, item]));
      groups = groups.filter(group => index.groups.has(group.id));
      if (this.queriedInterval && this.showQueriedInterval) {
        groups.push({ id: 'queried-interval', content: 'queried interval' });
        items.push({
          id: 'queried-interval',
          group: 'queried-interval',
          content: 'query',
          start: this.queriedInterval[0].valueOf(),
          end: this.queriedInterval[1].valueOf(),
          style: 'background-color: #aaa; height: 10px',
          subgroup: '',
        });
      }
      syncTimelineData(this.groupData, groups);
      syncTimelineData(this.itemData, items);
      this.items = items;
      this.groups = groups;
    },
  },
};
</script>
