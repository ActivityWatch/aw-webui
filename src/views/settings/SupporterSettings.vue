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

function isLegacySupporter(): boolean {
  try {
    return localStorage.getItem(LEGACY_SUPPORTER_KEY) === 'true';
  } catch {
    return false;
  }
}

export default {
  name: 'SupporterSettings',
  computed: {
    supporter: {
      get(): boolean {
        return !!useSettingsStore().supporter || isLegacySupporter();
      },
      set(v: boolean) {
        try {
          localStorage.removeItem(LEGACY_SUPPORTER_KEY);
        } catch {
          // localStorage unavailable — nothing to clear.
        }
        useSettingsStore().update({ supporter: v });
      },
    },
  },
};
</script>
