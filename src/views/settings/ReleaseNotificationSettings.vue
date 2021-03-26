<template lang="pug">
div
  div.d-flex.justify-content-between
    div
      h5.mb-0 New release notification
    div
      b-form-checkbox(v-model="data.isEnabled" switch)
  small
    | We will send you a notification if there is a new release available for download, this check will happen at most once per day.
</template>

<script>
import moment from 'moment';
import NewReleaseNotification from '~/components/NewReleaseNotification.vue';

const SHORT_BACKOFF_PERIOD = NewReleaseNotification.SHORT_BACKOFF_PERIOD;

export default {
  data() {
    return {
      data: {
        isEnabled: true,
        nextCheckTime: moment().add(SHORT_BACKOFF_PERIOD, 'seconds'),
        howOftenToCheck: SHORT_BACKOFF_PERIOD,
        timesChecked: 0,
      },
    };
  },
  watch: {
    data: {
      handler() {
        this.saveData();
      },
      deep: true,
    },
  },
  created() {
    this.retrieveData();
  },
  methods: {
    retrieveData() {
      if (localStorage.newReleaseCheckData) {
        try {
          this.data = JSON.parse(localStorage.newReleaseCheckData);
        } catch (e) {
          console.error('could not parse newReleaseCheckData, deleting');
          localStorage.removeItem('newReleaseCheckData');
        }
      } else {
        console.info('newReleaseCheckData not found in localStorage');
      }
    },
    saveData() {
      const parsed = JSON.stringify(this.data);
      localStorage.newReleaseCheckData = parsed;
    },
  },
};
</script>
