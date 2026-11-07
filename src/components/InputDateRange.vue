<template lang="pug">
//- The two dates of a range (YYYY-MM-DD): the Timeline's, also the export's.
span.d-inline-flex.flex-wrap.align-items-center
  input.form-control.form-control-sm.mr-1(
    type="date", :value="start", @input="$emit('update:start', $event.target.value)",
    :max="end || undefined", style="width: auto", :aria-label="$t('ui.timeInterval.startDate')"
  )
  input.form-control.form-control-sm.mr-1(
    type="date", :value="end", @input="$emit('update:end', $event.target.value)",
    :min="start || undefined", :placeholder="$t('ui.timeInterval.optional')", style="width: auto",
    :aria-label="$t('ui.timeInterval.endDate')"
  )
</template>

<script lang="ts">
export default {
  name: 'InputDateRange',
  props: { start: { type: String, default: '' }, end: { type: String, default: '' } },
};
</script>
