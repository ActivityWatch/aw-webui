<template lang="pug">
//- Always visible (desktop navbar and phone navbar), never hidden in a collapsed menu.
b-button.aw-notice-bell.px-2.px-lg-1(
  variant="link"
  data-testid="notice-bell"
  :aria-label="label"
  :title="label"
  @click="notices.open()"
)
  icon(name="bell")
  span.aw-notice-dot(v-if="notices.hasUnseen" data-testid="notice-bell-dot")
</template>

<style lang="scss" scoped>
.aw-notice-bell {
  position: relative;
  color: inherit;
  min-width: 44px;
  min-height: 44px;
}
.aw-notice-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #dc3545;
}
</style>

<script lang="ts">
import 'vue-awesome/icons/bell';
import { useNoticesStore } from '~/stores/notices';

export default {
  name: 'NoticeBell',
  computed: {
    notices() {
      return useNoticesStore();
    },
    label() {
      return this.notices.hasUnseen ? this.$t('ui.notices.bellUnseen') : this.$t('ui.notices.bell');
    },
  },
};
</script>
