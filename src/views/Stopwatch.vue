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
      | {{ $t('stopwatch.aboutBodyBefore') }}
      | {{ $t('stopwatch.aboutDashboardBefore') }}
      b {{ $t('activity.editView') }}
      | {{ $t('stopwatch.aboutDashboardMiddle') }}
      b {{ $t('activity.addVisualization') }}
      | {{ $t('stopwatch.aboutDashboardAfter') }}
      b {{ $t('visualizations.topStopwatchEvents') }}
      | .

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

  hr

  div(v-if="loading")
    b-spinner.mr-2(small)
    span.text-muted {{ $t('stopwatch.loading') }}
  div(v-else)
    h3.mt-3 {{ $t('stopwatch.running') }}
    div(v-if="runningTimers.length > 0")
      div(v-for="e in runningTimers" :key="e.id")
        stopwatch-entry(:event="e", :bucket_id="bucket_id", :now="now",
          @delete="removeTimer", @update="updateTimer")
    p.text-muted.mb-0(v-else) {{ $t('stopwatch.noRunning') }}

    div(v-if="stoppedTimers.length > 0")
      h3.mt-4.mb-2 {{ $t('stopwatch.history') }}
      div(v-for="k in Object.keys(timersByDate).sort().reverse()" :key="k")
        h5.mt-3.mb-1 {{ k }}
        div(v-for="e in timersByDate[k]" :key="e.id")
          stopwatch-entry(:event="e", :bucket_id="bucket_id", :now="now",
            @delete="removeTimer", @update="updateTimer", @new="startTimer(e.data.label)")
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
      bucket_id: 'aw-stopwatch',
      events: [],
      label: '',
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

    // TODO: Get all timer events
    await this.getEvents();

    setInterval(() => (this.now = moment()), 1000);
  },
  methods: {
    startTimer: async function (label) {
      const event = {
        timestamp: new Date(),
        data: {
          running: true,
          label: label,
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
    },

    removeTimer: function (event) {
      this.events = _.filter(this.events, e => e.id != event.id);
    },

    getEvents: async function () {
      this.events = await this.$aw.getEvents(this.bucket_id, { limit: 100 });
      this.loading = false;
    },
  },
};
</script>
