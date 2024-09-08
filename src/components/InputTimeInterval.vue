<template lang="pug">
div
  div
    b-alert(v-if="invalidDaterange", variant="warning", show)
      | The selected date range is invalid. The second date must be greater or equal to the first date.
    b-alert(v-if="daterangeTooLong", variant="warning", show)
      | The selected date range is too long. The maximum is {{ maxDuration/(24*60*60) }} days.

  table
    tr
      td.pr-2
        label.col-form-label Show last:
      td(colspan=2)
        .btn-group(role="group")
            input(type="radio", id="dur1", :value="15*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur1").btn.btn-light.rounded-left &frac14;h
            input(type="radio", id="dur2", :value="30*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur2").btn.btn-light &frac12;h
            input(type="radio", id="dur3", :value="1*60*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur3").btn.btn-light 1h
            input(type="radio", id="dur4", :value="2*60*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur4").btn.btn-light 2h
            input(type="radio", id="dur5", :value="3*60*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur5").btn.btn-light 3h
            input(type="radio", id="dur6", :value="4*60*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur6").btn.btn-light 4h
            input(type="radio", id="dur7", :value="6*60*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur7").btn.btn-light 6h
            input(type="radio", id="dur8", :value="12*60*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur8").btn.btn-light 12h
            input(type="radio", id="dur9", :value="24*60*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur9").btn.btn-light 24h
            input(type="radio", id="dur10", :value="48*60*60", v-model="duration", @change="applyLastDuration").sr-only
            label(for="dur10").btn.btn-light 48h

    tr
      td.pr-2
        label.col-form-label Show from:
      td
        input.form-control.d-inline-block.p-1(type="date", v-model="start", style="height: auto; width: auto;")
        label.col-form-label.pr-1.pl-2 to:
        input.form-control.d-inline.p-1(type="date", v-model="end", style="height: auto; width: auto")
      td.text-right
        button(
          class="btn btn-outline-dark btn-sm",
          type="button",
          :disabled="invalidDaterange || emptyDaterange || daterangeTooLong",
          @click="applyRange"
        ) Apply

  div.mt-1.small.text-muted(v-if="lastUpdate", v-bind:title="lastUpdate")
    | Last update: #[time(:datetime="lastUpdate.format()") {{lastUpdate | friendlytime}}]
</template>

<style scoped lang="scss">
.btn-group {
  input[type='radio']:checked + label {
    background-color: #aaa;
  }
}
</style>

<script lang="ts">
import moment from 'moment';
import 'vue-awesome/icons/sync';
export default {
  name: 'input-timeinterval',
  props: {
    defaultDuration: {
      type: Number,
      default: 60 * 60,
    },
    maxDuration: {
      type: Number,
      default: null,
    },
    showUpdate: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      duration: null,
      mode: 'last_duration',
      start: null,
      end: null,
      lastUpdate: null,
    };
  },
  computed: {
    value: {
      get() {
        if (this.mode == 'range' && this.start && this.end) {
          return [moment(this.start), moment(this.end).add(1, 'day')];
        } else {
          return [moment().subtract(this.duration, 'seconds'), moment()];
        }
      },
    },
    emptyDaterange() {
      return !(this.start && this.end);
    },
    invalidDaterange() {
      return moment(this.start) > moment(this.end);
    },
    daterangeTooLong() {
      return moment(this.start).add(this.maxDuration, 'seconds').isBefore(moment(this.end));
    },
  },
  mounted() {
    this.duration = this.defaultDuration;
    this.valueChanged();

    // We want our lastUpdated text to update every ~3s
    // We can do this by setting it to null and then the previous value.
    this.lastUpdateTimer = setInterval(() => {
      const _lastUpdate = this.lastUpdate;
      this.lastUpdate = null;
      this.lastUpdate = _lastUpdate;
    }, 3000);
  },
  beforeDestroy() {
    clearInterval(this.lastUpdateTimer);
  },
  methods: {
    valueChanged() {
      if (
        this.mode == 'last_duration' ||
        (!this.emptyDaterange && !this.invalidDaterange && !this.daterangeTooLong)
      ) {
        this.lastUpdate = moment();
        this.$emit('input', this.value);
      }
    },
    applyRange() {
      this.mode = 'range';
      this.duration = 0;
      this.valueChanged();
    },
    applyLastDuration() {
      this.mode = 'last_duration';
      this.valueChanged();
    },
  },
};
</script>
