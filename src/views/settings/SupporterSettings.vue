<template lang="pug">
div
  div.d-sm-flex.justify-content-between.align-items-center
    div.mr-2
      h5.mb-0#supporter-label {{ $t('settings.supporter.title') }}
    div
      b-form-checkbox(v-model="supporter" switch aria-labelledby="supporter-label")
  small.text-muted
    | {{ $t('settings.supporter.help') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

// Pre-server-storage honor-system flag. Honoured so users who set it before the
// setting existed don't see the prompts come back, but an explicit toggle wins
// (otherwise the switch could never turn the prompts back on for them).
const LEGACY_SUPPORTER_KEY = 'aw-supporter';

// Navigation destroys the component, not pending writes. Share the queue so a
// newly mounted switch cannot save ahead of an older instance's pending choice.
let saveQueue = Promise.resolve();

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
    supporter: {
      get(): boolean {
        return !!useSettingsStore().supporter || this.legacySupporter;
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
        this.saveQueue = saveQueue = saveQueue
          .then(() => store.update({ supporter: v }))
          .catch(error => console.error('Could not save supporter preference', error));
      },
    },
  },
};
</script>
