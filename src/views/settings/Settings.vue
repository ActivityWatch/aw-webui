<template lang="pug">
div
  h3.mb-3 Settings

  div.settings-layout
    nav.settings-nav
      b-nav(pills vertical)
        b-nav-item(
          v-for="group in groups"
          :key="group.id"
          :active="activeGroup === group.id"
          @click="activeGroup = group.id"
          link-classes="settings-nav__link"
        ) {{ group.label }}

    div.settings-content
      template(v-for="group in groups")
        section.settings-section(v-show="activeGroup === group.id" :key="group.id")
          h4.settings-section__title {{ group.label }}
          p.text-muted.small.mb-3(v-if="group.help") {{ group.help }}
          component(v-for="comp in group.components" :key="comp.name" :is="comp.name")
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';

import DaystartSettings from '~/views/settings/DaystartSettings.vue';
import TimelineDurationSettings from '~/views/settings/TimelineDurationSettings.vue';
import ReleaseNotificationSettings from '~/views/settings/ReleaseNotificationSettings.vue';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import LandingPageSettings from '~/views/settings/LandingPageSettings.vue';
import DeveloperSettings from '~/views/settings/DeveloperSettings.vue';
import Theme from '~/views/settings/Theme.vue';
import ColorSettings from '~/views/settings/ColorSettings.vue';
import ActivePatternSettings from '~/views/settings/ActivePatternSettings.vue';
import PrivacyFilterSettings from '~/views/settings/PrivacyFilterSettings.vue';

interface Group {
  id: string;
  label: string;
  help?: string;
  components: { name: string }[];
}

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
    ActivePatternSettings,
    PrivacyFilterSettings,
  },
  beforeRouteLeave(to, from, next) {
    const categoryStore = useCategoryStore();
    if (categoryStore.classes_unsaved_changes) {
      if (confirm('Your categories have unsaved changes, are you sure you want to leave?')) {
        next();
      } else {
        next(false);
      }
    } else {
      next();
    }
  },
  data() {
    return {
      activeGroup: 'general',
    };
  },
  computed: {
    groups(): Group[] {
      const general: Group = {
        id: 'general',
        label: 'General',
        help: 'Defaults that shape how time periods, the timeline, and landing page behave.',
        components: [
          { name: 'DaystartSettings' },
          { name: 'TimelineDurationSettings' },
          { name: 'LandingPageSettings' },
        ],
      };
      const appearance: Group = {
        id: 'appearance',
        label: 'Appearance',
        help: 'Theme and visualization colors.',
        components: [{ name: 'Theme' }, { name: 'ColorSettings' }],
      };
      const notifications: Group = {
        id: 'notifications',
        label: 'Notifications',
        components: [{ name: 'ReleaseNotificationSettings' }],
      };
      const categorization: Group = {
        id: 'categorization',
        label: 'Categorization',
        help: 'Rules that classify events into categories, plus AFK/active-pattern overrides.',
        components: [{ name: 'ActivePatternSettings' }, { name: 'CategorizationSettings' }],
      };
      const privacy: Group = {
        id: 'privacy',
        label: 'Privacy',
        help: 'Filters that drop or redact sensitive event data before it is stored.',
        components: [{ name: 'PrivacyFilterSettings' }],
      };
      const developer: Group = {
        id: 'developer',
        label: 'Developer',
        components: [{ name: 'DeveloperSettings' }],
      };

      const groups: Group[] = [general, appearance];
      if (!this.$isAndroid) groups.push(notifications);
      groups.push(categorization, privacy, developer);
      return groups;
    },
  },
  async created() {
    await this.init();
  },
  methods: {
    async init() {
      const settingsStore = useSettingsStore();
      return settingsStore.load();
    },
  },
};
</script>

<style scoped lang="scss">
.settings-layout {
  display: grid;
  grid-template-columns: minmax(180px, 220px) 1fr;
  gap: 2rem;
  margin-top: 0.5rem;
}

.settings-nav {
  position: sticky;
  top: 1rem;
  align-self: start;
}

::v-deep .settings-nav .nav-link {
  color: #495057;
  border-radius: 0.25rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.125rem;
}

::v-deep .settings-nav .nav-link:hover {
  background-color: #f0f1f3;
}

::v-deep .settings-nav .nav-link.active,
::v-deep .settings-nav .nav-link.active:hover {
  background-color: #495057 !important;
  color: #fff !important;
}

.settings-content {
  min-width: 0; // prevent grid blowout from long content
}

.settings-section__title {
  margin-bottom: 0.25rem;
}

.settings-section ::v-deep > * + * {
  margin-top: 1.25rem;
}

.settings-section ::v-deep .form-group,
.settings-section ::v-deep .b-form-group {
  margin-bottom: 0;
}

.settings-section ::v-deep hr {
  margin: 1.5rem 0;
}

@media (max-width: 767px) {
  .settings-layout {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .settings-nav {
    position: static;
  }

  ::v-deep .settings-nav .nav {
    flex-direction: row !important;
    overflow-x: auto;
    flex-wrap: nowrap;
    gap: 0.25rem;
  }

  ::v-deep .settings-nav .nav-link {
    white-space: nowrap;
  }
}
</style>
