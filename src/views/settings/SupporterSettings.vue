<template lang="pug">
div
  div.d-sm-flex.justify-content-between.align-items-center
    div.mr-2
      h5.mb-0#supporter-label {{ $t('settings.supporter.title') }}
    div
      b-form-checkbox(v-model="supporter" switch aria-labelledby="supporter-label")
  small.text-muted
    | {{ $t('settings.supporter.help') }}
  div.alert.alert-danger.mt-2(v-if="saveError" role="alert")
    | {{ $t('settings.notifications.saveFailed', { error: saveError }) }}
</template>

<script lang="ts">
import Vue from 'vue';
import { useSettingsStore } from '~/stores/settings';

// Pre-server-storage honor-system flag. Honoured so users who set it before the
// setting existed don't see the prompts come back, but an explicit toggle wins
// (otherwise the switch could never turn the prompts back on for them).
const LEGACY_SUPPORTER_KEY = 'aw-supporter';

// Navigation destroys the component, not pending writes. Share the queue so a
// newly mounted switch cannot save ahead of an older instance's pending choice.
let saveQueue = Promise.resolve();
const pendingChoice = Vue.observable({ value: null as boolean | null, error: '' });

function isLegacySupporter(): boolean {
  try {
    return localStorage.getItem(LEGACY_SUPPORTER_KEY) === 'true';
  } catch {
    return false;
  }
}

export default {
  name: 'SupporterSettings',
  data() {
    return { saveQueue: Promise.resolve(), legacySupporter: isLegacySupporter() };
  },
  computed: {
    saveError(): string {
      return pendingChoice.error;
    },
    supporter: {
      get(): boolean {
        return pendingChoice.value ?? (!!useSettingsStore().supporter || this.legacySupporter);
      },
      set(v: boolean) {
        this.legacySupporter = false;
        try {
          localStorage.removeItem(LEGACY_SUPPORTER_KEY);
        } catch {
          // localStorage unavailable — nothing to clear.
        }
        // Each update reloads the store after saving. Keep toggle writes in
        // selection order so an earlier reload cannot overwrite the last choice.
        const store = useSettingsStore();
        pendingChoice.value = v;
        const save = saveQueue
          .then(async () => {
            await store.update({ supporter: v });
            pendingChoice.error = '';
          })
          .catch(error => {
            pendingChoice.error = error instanceof Error ? error.message : String(error);
            console.error('Could not save supporter preference', error);
          })
          .then(() => {
            // Older completions must not clear a newer queued selection.
            if (saveQueue === save) pendingChoice.value = null;
          });
        this.saveQueue = saveQueue = save;
      },
    },
  },
};
</script>
