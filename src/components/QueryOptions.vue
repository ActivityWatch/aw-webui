<template lang="pug">
div
  b-form-group(label="Hostname" label-cols=2)
    b-form-select(v-model="queryOptionsData.hostname")
      option(v-for="hostname in hostnameChoices")
        | {{hostname}}
  b-form-group(label="Start" label-cols=2)
    b-form-datepicker(v-model="queryOptionsData.start")
  b-form-group(label="Stop" label-cols=2)
    b-form-datepicker(v-model="queryOptionsData.stop")
  b-form-group(label="Toggles" label-cols=2)
    b-form-checkbox(type="checkbox" v-model="queryOptionsData.filter_afk" label="Filter AFK" description="")
      label Exclude time away from computer
</template>

<script lang="ts">
import Vue from 'vue';
import moment from 'moment';
import { useBucketsStore } from '~/stores/buckets';

export default Vue.extend({
  name: 'QueryOptions',
  props: {
    queryOptions: {
      type: Object,
    },
  },
  data() {
    return {
      bucketsStore: useBucketsStore(),

      queryOptionsData: {
        hostname: '',
        start: moment().subtract(1, 'day').format('YYYY-MM-DD'),
        stop: moment().add(1, 'day').format('YYYY-MM-DD'),
        filter_afk: true,
      },
    };
  },

  computed: {
    hostnameChoices() {
      return this.bucketsStore.hosts;
    },
  },

  watch: {
    queryOptionsData: {
      handler(value) {
        this.$emit('input', value);
      },
      deep: true,
    },
  },

  async mounted() {
    await this.bucketsStore.ensureLoaded();
    this.queryOptionsData = {
      ...this.queryOptionsData,
      hostname: this.hostnameChoices[0],
      ...this.queryOptions,
    };
    this.$emit('input', this.queryOptionsData);
  },
});
</script>
