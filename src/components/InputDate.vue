<template lang="pug">
//- Date picker that honours the "Start of week" setting.
//- Native <input type="date"> takes its first weekday from the browser
//- locale and can't be configured, so we use the bootstrap-vue datepicker.
b-form-datepicker.input-date(
  :value="value || ''",
  :min="min || undefined",
  :max="max || undefined",
  :start-weekday="startWeekday",
  :locale="$i18n ? $i18n.locale : undefined",
  :date-format-options="dateFormatOptions",
  :reset-button="resetButton",
  :placeholder="placeholder",
  :aria-label="ariaLabel",
  :title="title",
  size="sm",
  hide-header,
  label-help="",
  :label-no-date-selected="$t('datepicker.noDateSelected')",
  :label-reset-button="$t('datepicker.resetButton')",
  :label-calendar="$t('datepicker.calendar')",
  :label-nav="$t('datepicker.nav')",
  :label-prev-year="$t('datepicker.prevYear')",
  :label-prev-month="$t('datepicker.prevMonth')",
  :label-current-month="$t('datepicker.currentMonth')",
  :label-next-month="$t('datepicker.nextMonth')",
  :label-next-year="$t('datepicker.nextYear')",
  :label-today="$t('datepicker.today')",
  @input="onInput"
)
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

// Weekday numbers as used by b-form-datepicker's start-weekday (0 = Sunday)
const WEEKDAYS: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Saturday: 6,
};

export default {
  name: 'input-date',
  props: {
    value: { type: String, default: '' },
    min: { type: String, default: null },
    max: { type: String, default: null },
    placeholder: { type: String, default: undefined },
    ariaLabel: { type: String, default: undefined },
    title: { type: String, default: undefined },
    resetButton: { type: Boolean, default: false },
  },
  data() {
    return {
      settingsStore: useSettingsStore(),
      dateFormatOptions: { year: 'numeric', month: '2-digit', day: '2-digit' },
    };
  },
  computed: {
    startWeekday(): number {
      return WEEKDAYS[this.settingsStore.startOfWeek] ?? 1;
    },
  },
  methods: {
    onInput(value: string) {
      this.$emit('input', value);
      // Emit change as well so callers used to native date inputs can listen for it
      this.$emit('change', value);
    },
  },
};
</script>
