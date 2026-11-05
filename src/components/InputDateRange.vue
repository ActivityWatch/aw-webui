<template lang="pug">
//- The dates of a range (YYYY-MM-DD), with optional times (HH:mm) when
//- allowTime is set: the Timeline's inputs, also the export dialog's.
span.d-inline-flex.flex-wrap.align-items-center
  input-date.mr-1(
    :value="start", @input="$emit('update:start', $event)", :max="end || undefined"
    :aria-label="$t('ui.timeInterval.startDate')"
  )
  input.form-control.form-control-sm.mr-1(
    v-if="allowTime", type="time", :value="startTime", style="width: auto"
    @input="$emit('update:startTime', $event.target.value || null)"
    :aria-label="$t('ui.timeInterval.startTime')"
  )
  input-date.mr-1(
    :value="end", @input="$emit('update:end', $event)", :min="start || undefined"
    :placeholder="$t('ui.timeInterval.optional')", reset-button
    :aria-label="$t('ui.timeInterval.endDate')"
  )
  input.form-control.form-control-sm.mr-1(
    v-if="allowTime", type="time", :value="endTime", style="width: auto"
    @input="$emit('update:endTime', $event.target.value || null)"
    :aria-label="$t('ui.timeInterval.endTime')"
  )
</template>

<script lang="ts">
import InputDate from '~/components/InputDate.vue';

export default {
  name: 'InputDateRange',
  components: { InputDate },
  props: {
    start: { type: String, default: null },
    end: { type: String, default: null },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    allowTime: { type: Boolean, default: false },
  },
};
</script>
