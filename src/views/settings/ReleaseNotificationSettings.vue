<template lang="pug">
div.row
  div.col-sm-9
    h5.mb-0 New release notification
    small
      | We will send you a notification if there is a new release available for download, this check will happen at most once per day
  div.col-sm-3
    select(id="enableNotification" v-model="data.isEnabled", @change="saveData")
      option(:value="true") Enabled
      option(:value="false") Disabled
</template>

<script>
import moment from 'moment';

const SHORT_BACKOFF_PERIOD = 24 * 60 * 60;
// The following may be used for testing, roughly 10s
// const SHORT_BACKOFF_PERIOD = 10;

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
  created() {
    this.retrieveData();
  },
  methods: {
    retrieveData() {
      if (localStorage.getItem('newReleaseCheckData')) {
        try {
          this.data = JSON.parse(localStorage.getItem('newReleaseCheckData'));
        } catch (e) {
          localStorage.removeItem('newReleaseCheckData');
        }
      }
    },
    saveData() {
      const parsed = JSON.stringify(this.data);
      localStorage.setItem('newReleaseCheckData', parsed);
    },
  },
};
</script>
