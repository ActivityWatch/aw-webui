<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mb-2.mb-sm-0 {{ $t('settings.timelineDuration.title') }}
    div
      b-select(size="sm" :value="durationDefault", @change="durationDefault = $event")
          option(:value="15*60") 15min
          option(:value="30*60") 30min
          option(:value="60*60") 1h
          option(:value="2*60*60") 2h
          option(:value="4*60*60") 4h
          option(:value="6*60*60") 6h
          option(:value="12*60*60") 12h
          option(:value="24*60*60") 24h
  small.text-muted
    | {{ $t('settings.timelineDuration.help') }}
  div.d-sm-flex.justify-content-between.align-items-center.mt-3
    label.mb-2.mb-sm-0(for="timeline-group-granularity") {{ $t('settings.timelineDuration.groupGranularity') }}
    b-form-input#timeline-group-granularity(size="sm" type="number" min="0" step="1" :value="timelineGroupGranularity" @change="timelineGroupGranularity = $event" aria-describedby="timeline-group-granularity-help" style="max-width: 8rem")
  small#timeline-group-granularity-help.text-muted
    | {{ $t('settings.timelineDuration.groupGranularityHelp') }}
  div.d-sm-flex.justify-content-between.align-items-center.mt-3
    label.mb-2.mb-sm-0(for="timeline-time-format") {{ $t('settings.timelineDuration.timeFormat') }}
    b-select#timeline-time-format(size="sm" :value="timelineTimeFormat" @change="timelineTimeFormat = $event" aria-describedby="timeline-time-format-help" style="max-width: 12rem")
      option(value="24h") {{ $t('settings.timelineDuration.timeFormat24h') }}
      option(value="12h") {{ $t('settings.timelineDuration.timeFormat12h') }}
  small#timeline-time-format-help.text-muted
    | {{ $t('settings.timelineDuration.timeFormatHelp') }}
</template>
<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'TimelineDurationSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
    };
  },
  computed: {
    timelineGroupGranularity: {
      get() {
        return Number(this.settingsStore.timelineGroupGranularity);
      },
      set(value) {
        const seconds = Number(value);
        if (Number.isFinite(seconds) && seconds >= 0) {
          this.settingsStore.update({ timelineGroupGranularity: seconds });
        }
      },
    },
    timelineTimeFormat: {
      get() {
        return this.settingsStore.timelineTimeFormat;
      },
      set(value) {
        this.settingsStore.update({ timelineTimeFormat: value });
      },
    },
    durationDefault: {
      get() {
        return this.settingsStore.durationDefault;
      },
      set(value) {
        console.log('Set default timeline duration to ' + value);
        this.settingsStore.update({ durationDefault: value });
      },
    },
  },
};
</script>
