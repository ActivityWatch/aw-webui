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
// Shared for the same reason: a save that completes after navigation must clear
// the legacy flag for the instance now on screen, not only the one that started it.
const legacyFlag = Vue.observable({ value: false });

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
    return { saveQueue: Promise.resolve() };
  },
  computed: {
    saveError(): string {
      return pendingChoice.error;
    },
    supporter: {
      get(): boolean {
        return pendingChoice.value ?? (!!useSettingsStore().supporter || legacyFlag.value);
      },
      set(v: boolean) {
        // Each update reloads the store after saving. Keep toggle writes in
        // selection order so an earlier reload cannot overwrite the last choice.
        const store = useSettingsStore();
        pendingChoice.value = v;
        const save = saveQueue
          .then(async () => {
            // Capture after older queued saves, not when the user clicks.
            const previousSupporter = store.supporter;
            try {
              await store.update({ supporter: v });
              // The explicit server choice now wins. Retire the legacy flag only
              // after it is persisted: clearing it before a failed save would
              // silently turn a pre-existing supporter's prompts back on.
              legacyFlag.value = false;
              try {
                localStorage.removeItem(LEGACY_SUPPORTER_KEY);
              } catch {
                // localStorage unavailable — nothing to clear.
              }
              pendingChoice.error = '';
            } catch (error) {
              // Reconcile with the server: the POST may have succeeded while
              // its follow-up reload failed. If offline, undo only this flag.
              await store.load().catch(() => store.$patch({ supporter: previousSupporter }));
              throw error;
            }
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
  created() {
    legacyFlag.value = isLegacySupporter();
  },
};
</script>
