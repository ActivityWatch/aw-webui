<template lang="pug">
//- Hosts every non-urgent notice in one modal, so none of them shifts the page layout.
//- Notice components are slotted in and stay mounted (static, non-lazy) so they can run
//- their own eligibility checks; the modal is closed unless the user opens it from the bell.
b-modal#aw-notices(
  v-model="open"
  static
  centered
  scrollable
  ok-only
  :title="$t('ui.notices.title')"
  :ok-title="$t('ui.notices.close')"
  data-testid="notice-host"
  @show="notices.markAllSeen()"
)
  p.text-muted(v-if="notices.count === 0" data-testid="notice-empty") {{ $t('ui.notices.empty') }}
  slot
</template>

<script lang="ts">
import { useNoticesStore } from '~/stores/notices';

export default {
  name: 'NoticeHost',
  computed: {
    notices() {
      return useNoticesStore();
    },
    open: {
      get() {
        return this.notices.isOpen;
      },
      set(value: boolean) {
        value ? this.notices.open() : this.notices.close();
      },
    },
  },
};
</script>
