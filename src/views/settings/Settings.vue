<template lang="pug">
div
  h3 Settings

  b-alert(variant="warning", show) #[b Note:] These settings are only saved in your browser and will not remain if you switch browser. We are working on getting this fixed.

  hr

  SettingsSyncSettings(v-bind="{ settingsData }")

  hr

  DaystartSettings(v-bind="{ settingsData }")

  hr

  TimelineDurationSettings(v-bind="{ settingsData }")

  hr

  LandingPageSettings(v-bind="{ settingsData }")

  hr

  Theme

  hr

  div(v-if="!$isAndroid")
    ReleaseNotificationSettings(v-bind="{ settingsData }")
    hr

  ColorSettings(v-bind="{ settingsData }")

  hr

  CategorizationSettings(v-bind="{ settingsData }")

  hr

  DeveloperSettings
</template>

<script>
import DaystartSettings from '~/views/settings/DaystartSettings.vue';
import TimelineDurationSettings from '~/views/settings/TimelineDurationSettings.vue';
import ReleaseNotificationSettings from '~/views/settings/ReleaseNotificationSettings.vue';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import LandingPageSettings from '~/views/settings/LandingPageSettings.vue';
import DeveloperSettings from '~/views/settings/DeveloperSettings.vue';
import Theme from '~/views/settings/Theme.vue';
import ColorSettings from '~/views/settings/ColorSettings.vue';
import SettingsSyncSettings from '~/views/settings/SettingsSyncSettings.vue';

import { getSettingsFromServer } from '~/util/settings';

export default {
  name: 'Settings',
  components: {
    DaystartSettings,
    TimelineDurationSettings,
    ReleaseNotificationSettings,
    CategorizationSettings,
    LandingPageSettings,
    Theme,
    ColorSettings,
    DeveloperSettings,
    SettingsSyncSettings,
  },
  data() {
    return {
      settingsData: {
        durationDefault: '86400',
        initialTimestamp: 'Thu Sep 23 2021 15:22:08 GMT+0530',
        newReleaseCheckData:
          '{"isEnabled":true,"nextCheckTime":"2021-09-29T09:51:36.782Z","howOftenToCheck":86400,"timesChecked":0}',
        startOfDay: '04:00',
        syncSettingsToServer: true,
        userSatisfactionPollData:
          '{"isEnabled":true,"nextPollTime":"2021-09-30T09:52:08.703Z","timesPollIsShown":0}',
      },
    };
  },
  async created() {
    await this.init();
  },
  methods: {
    async init() {
      // read data from localstorage
      const {
        syncSettingsToServer,
        startOfDay,
        newReleaseCheckData,
        initialTimestamp,
        durationDefault,
        userSatisfactionPollData,
      } = localStorage;

      // check if its a new user and set sync accordingly
      await this.checkNewUser(syncSettingsToServer, durationDefault);

      let data;
      // if server sync enabled, get settings from server
      if (syncSettingsToServer) {
        data = await getSettingsFromServer();
      } else {
        data = {
          syncSettingsToServer,
          startOfDay,
          newReleaseCheckData,
          initialTimestamp,
          durationDefault,
          userSatisfactionPollData,
        };
      }
      this.settingsData = data;
      return;
    },
    async checkNewUser(syncSettingsToServer, durationDefault) {
      if (syncSettingsToServer == undefined) {
        // sync property doesn't exist
        if (durationDefault) {
          // existing user, set sync to false by default
          localStorage.setItem('syncSettingsToServer', 'false');
        } else {
          // new user, keep sync on by default
          localStorage.setItem('syncSettingsToServer', 'true');
        }
      }
      return;
    },
  },
};
</script>
