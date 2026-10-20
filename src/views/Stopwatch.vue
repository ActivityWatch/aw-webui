<template lang="pug">
div
  div.d-flex.align-items-center.mb-3
    h3.mb-0 {{ $t('stopwatch.title') }}
    button.btn.btn-link.p-0.ml-2.text-muted(
      id="stopwatch-help"
      type="button"
      :aria-label="$t('stopwatch.aboutTitle')"
    )
      icon(name="question-circle")
    b-popover(
      target="stopwatch-help"
      triggers="hover focus click blur"
      placement="bottom"
      :title="$t('stopwatch.aboutTitle')"
    )
      | {{ $t('stopwatch.aboutBody') }}

  b-input-group(size="lg")
    b-input(
      v-model="label"
      :placeholder="$t('stopwatch.placeholder')"
      :aria-label="$t('stopwatch.placeholder')"
      @keyup.enter="startTimer(label)"
    )
    b-input-group-append
      b-button(@click="startTimer(label)", variant="success")
        icon(name="play")
        | {{ $t('stopwatch.start') }}

  b-form-group.mt-2(:label="$t('stopwatch.tagsLabel')" label-for="stopwatch-tags")
    b-input(id="stopwatch-tags" data-testid="stopwatch-tags" v-model="tags" placeholder="work, meeting")

  hr

  b-alert(v-if="error" show variant="danger")
    | {{ error }}
    b-button.ml-2(size="sm" :disabled="refreshing" @click="getEvents()") Retry

  div(v-if="loading")
    b-spinner.mr-2(small)
    span.text-muted {{ $t('common.loading') }}
  div(v-else)
    h3.mt-3 {{ $t('stopwatch.running') }}
    div(v-if="runningTimers.length > 0")
      div(v-for="e in runningTimers" :key="e.id")
        stopwatch-entry(:event="e", :bucket_id="bucket_id", :now="now",
          @delete="removeTimer", @update="updateTimer")
    p.text-muted.mb-0(v-else) {{ $t('stopwatch.noRunning') }}

    b-button.mt-2(
      v-if="hasMoreRunning" :disabled="refreshing"
      @click="getEvents(runningLimit + 100, historyLimit)"
      variant="outline-secondary"
    ) Show more running timers

    div(v-if="stoppedTimers.length > 0")
      h3.mt-4.mb-2 {{ $t('stopwatch.history') }}
      div(v-for="k in Object.keys(timersByDate).sort().reverse()" :key="k")
        h5.mt-3.mb-1 {{ k }}
        div(v-for="e in timersByDate[k]" :key="e.id")
          stopwatch-entry(:event="e", :bucket_id="bucket_id", :now="now",
            @delete="removeTimer", @update="updateTimer", @new="startTimer(e.data.label, e.data.tags || [])")
      b-button.mt-3(
        v-if="hasMoreHistory" :disabled="refreshing"
        @click="getEvents(runningLimit, historyLimit + 100)"
        variant="outline-secondary"
      ) Show more history
</template>

<style scoped lang="scss">
.btn {
  margin-right: 0.5em;

  .fa-icon {
    margin-left: 0;
    margin-right: 0.5em;
  }
}
</style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { parseTags } from '../util/tags';

import StopwatchEntry from '../components/StopwatchEntry.vue';
import 'vue-awesome/icons/play';
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/question-circle';

export default {
  name: 'Stopwatch',
  components: {
    'stopwatch-entry': StopwatchEntry,
  },
  data: () => {
    return {
      loading: true,
      refreshing: false,
      error: null,
      requestId: 0,
      runningLimit: 100,
      historyLimit: 100,
      requestedRunningLimit: 100,
      requestedHistoryLimit: 100,
      hasMoreRunning: false,
      hasMoreHistory: false,
      bucket_id: 'aw-stopwatch',
      events: [],
      label: '',
      tags: '',
      now: moment(),
    };
  },
  computed: {
    runningTimers() {
      return _.filter(this.events, e => e.data.running);
    },
    stoppedTimers() {
      return _.filter(this.events, e => !e.data.running);
    },
    timersByDate() {
      return _.groupBy(this.stoppedTimers, e => moment(e.timestamp).format('YYYY-MM-DD'));
    },
  },
  mounted: async function () {
    // TODO: List all possible timer buckets
    //this.getBuckets();

    // Create default timer bucket
    await this.$aw.ensureBucket(this.bucket_id, 'general.stopwatch', 'unknown');

    await this.getEvents();

    setInterval(() => (this.now = moment()), 1000);
  },
  methods: {
    startTimer: async function (label, tags = parseTags(this.tags)) {
      const event = {
        timestamp: new Date(),
        data: {
          running: true,
          label: label,
          tags: [...tags],
        },
      };
      await this.$aw.heartbeat(this.bucket_id, 1, event);
      await this.getEvents();
    },

    updateTimer: async function (new_event) {
      const i = this.events.findIndex(e => e.id == new_event.id);
      if (i != -1) {
        // This is needed instead of this.events[i] because insides of arrays
        // are not reactive in Vue
        this.$set(this.events, i, new_event);
      } else {
        console.error(':(');
      }
      await this.getEvents();
    },

    removeTimer: async function (event) {
      this.events = _.filter(this.events, e => e.id != event.id);
      await this.getEvents();
    },

    getEvents: async function (
      runningLimit = this.requestedRunningLimit,
      historyLimit = this.requestedHistoryLimit
    ) {
      this.requestedRunningLimit = runningLimit;
      this.requestedHistoryLimit = historyLimit;
      const requestId = ++this.requestId;
      this.refreshing = true;
      this.error = null;
      try {
        // Filter before limiting: an old running timer must not compete with history.
        // The server scans the bucket, but only the requested prefixes (+ one sentinel)
        // cross the wire. Growing prefixes also preserve events with tied timestamps.
        const query = `events = query_bucket(${JSON.stringify(this.bucket_id)});
          RETURN = {
            "running": limit_events(filter_keyvals(events, "running", [true]), ${runningLimit + 1}),
            "history": limit_events(exclude_keyvals(events, "running", [true]), ${historyLimit + 1})
          };`;
        // Stay within older Rust servers' nanosecond timestamp range. A broad interval
        // keeps real stopwatch timestamps/durations intact instead of clipping a page.
        // Use POST directly: aw-client 0.3.x's query(cache:false) returns no results.
        const response = await this.$aw.req.post('/0/query/', {
          timeperiods: ['1677-09-22T00:00:00Z/2262-04-11T00:00:00Z'],
          query: [query],
        });
        if (requestId !== this.requestId) return;
        const { running, history: stopped } = response.data[0];
        this.events = [...running.slice(0, runningLimit), ...stopped.slice(0, historyLimit)].map(
          e => ({ ...e, timestamp: new Date(e.timestamp) })
        );
        this.runningLimit = runningLimit;
        this.historyLimit = historyLimit;
        this.hasMoreRunning = running.length > runningLimit;
        this.hasMoreHistory = stopped.length > historyLimit;
      } catch (error) {
        if (requestId === this.requestId) {
          this.error = 'Unable to load stopwatch timers. Please retry.';
        }
      } finally {
        if (requestId === this.requestId) {
          this.loading = false;
          this.refreshing = false;
        }
      }
    },
  },
};
</script>
