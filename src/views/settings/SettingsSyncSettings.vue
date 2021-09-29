<template lang="pug">
div
  div.d-flex.justify-content-between
    div
      h5.mb-0 Sync settings to server
    div
      b-form-checkbox(v-model="data.isEnabled" switch)
  small
    | This will sync settings to server so that they are persistent across all broswer windows
</template>

<script>
import { updateSettingOnServer } from '~/util/settings';

export default {
  props: {
    settingsData: {
      type: Object,
    },
  },
  data() {
    return {
      data: {
        isEnabled: this.settingsData.syncSettingsToServer == true,
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
  // created() {
  //   this.retrieveData();
  // },
  methods: {
    // retrieveData() {
    // console.log(this.settingsData);
    // if (localStorage.syncSettingsToServer) {
    //   try {
    //     this.data = JSON.parse(localStorage.newReleaseCheckData);
    //   } catch (e) {
    //     console.error('could not parse newReleaseCheckData, deleting');
    //     localStorage.removeItem('newReleaseCheckData');
    //   }
    // } else {
    //   console.info('newReleaseCheckData not found in localStorage');
    // }
    // },
    saveData() {
      // console.log('updating');
      this.settingsData.syncSettingsToServer = !this.settingsData.syncSettingsToServer;
      updateSettingOnServer('syncSettingsToServer', this.settingsData.syncSettingsToServer);
      // localStorage.setItem('syncSettingsToServer', );
      // const parsed = JSON.stringify(this.data);
      // localStorage.newReleaseCheckData = parsed;
    },
  },
};
</script>
