<template lang="pug">
div
  h3 Settings

  b-alert(variant="warning", show) #[b Note:] These settings are only saved in your browser and will not remain if you switch browser. We are working on getting this fixed.

  hr

  DaystartSettings

  hr

  TimelineDurationSettings

  hr

  LandingPageSettings

  hr

  div(v-if="!$isAndroid")
    ReleaseNotificationSettings
    hr

  CategorizationSettings

</template>

<script>
import DaystartSettings from '~/views/settings/DaystartSettings.vue';
import TimelineDurationSettings from '~/views/settings/TimelineDurationSettings.vue';
import ReleaseNotificationSettings from '~/views/settings/ReleaseNotificationSettings.vue';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import LandingPageSettings from '~/views/settings/LandingPageSettings.vue';

export default {
  name: 'Settings',
  components: {
    DaystartSettings,
    TimelineDurationSettings,
    ReleaseNotificationSettings,
    CategorizationSettings,
    LandingPageSettings,
  },
};
</script>
