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
          :to="`/settings/${group.id}`"
          link-classes="settings-nav__link"
          replace
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
import UncategorizedHintSettings from '~/views/settings/UncategorizedHintSettings.vue';
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
    UncategorizedHintSettings,
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
  props: {
    // Hydrated from the /settings/:group route param so reloads / direct
    // links preserve which panel is open.
    group: { type: String, default: '' },
  },
  computed: {
    activeGroup(): string {
      const requested = this.group || 'general';
      return this.groups.some(g => g.id === requested) ? requested : 'general';
    },
    groups(): Group[] {
      const general: Group = {
        id: 'general',
        label: 'General',
        help: 'Defaults that shape how time periods, the timeline, and landing page behave.',
        components: [
          { name: 'DaystartSettings' },
          { name: 'TimelineDurationSettings' },
          { name: 'LandingPageSettings' },
          { name: 'UncategorizedHintSettings' },
          // Release-notification check folded in here so it doesn't
          // need its own one-setting "Updates" panel.
          ...(this.$isAndroid ? [] : [{ name: 'ReleaseNotificationSettings' }]),
        ],
      };
      const appearance: Group = {
        id: 'appearance',
        label: 'Appearance',
        help: 'Theme and visualization colors.',
        components: [{ name: 'Theme' }, { name: 'ColorSettings' }],
      };
      const categorization: Group = {
        id: 'categorization',
        label: 'Categorization',
        help: 'Rules that classify events into categories, plus AFK/active-pattern overrides.',
        // CategorizationSettings (rules) is the primary content; the
        // ActivePatternSettings AFK override is an advanced edge-case
        // setting so it lives at the bottom of the group.
        components: [{ name: 'CategorizationSettings' }, { name: 'ActivePatternSettings' }],
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

      const groups: Group[] = [general, appearance, categorization, privacy, developer];
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

.settings-section {
  // Modest breathing room at the end of each panel — keeps long
  // subviews from crashing into the card border without making
  // short ones feel overly padded.
  padding-bottom: 1rem;
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

@media (max-width: 767.98px) {
  .settings-layout {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .settings-nav {
    position: static;
    // Keep the nav fully inside the layout so the horizontal pill row
    // doesn't push the page to overflow at xs widths.
    min-width: 0;
    max-width: 100%;
  }

  // Flex-wrap the pills onto multiple rows instead of overflow-x: auto.
  // The hidden horizontal scrollbar produced "incorrect" extra horizontal
  // scroll space on xs viewports and let pills like "Developer" hide
  // off-screen — both of which break discoverability.
  ::v-deep .settings-nav .nav {
    flex-direction: row !important;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  ::v-deep .settings-nav .nav-link {
    white-space: nowrap;
    padding: 0.375rem 0.625rem;
  }
}
</style>
