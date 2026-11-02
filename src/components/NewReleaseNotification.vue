<template lang="pug">
  div
    b-alert(v-if="isVisible", variant="info", show)
      | {{ $t('ui.release.newAvailable', { version: latestVersion }) }}
      | #[a(href="https://activitywatch.net/downloads/" target="_blank" class="alert-link") {{ $t('ui.release.download') }}],
      | {{ $t('ui.release.disablePrefix') }} #[a(href="javascript:void(0);" class="alert-link" @click="disableCheck") {{ $t('ui.release.disable') }}]
      | {{ $t('ui.release.disableSuffix') }}
      button(type="button", class="close", @click="isVisible=false") &times;

    b-alert(v-if="isFollowUpVisible", variant="success", show)
      | {{ $t('ui.release.disabled') }}
      | #[router-link(to="/settings" class="alert-link" @click.native="isFollowUpVisible=false") {{ $t('ui.release.settingsPage') }}].
      button(type="button", class="close", @click="isFollowUpVisible=false") &times;
</template>

<script lang="ts">
import axios from 'axios';
import moment from 'moment';
import semver from 'semver';
import { mapState } from 'pinia';

import { useSettingsStore, LONG_BACKOFF_PERIOD, SHORT_BACKOFF_PERIOD } from '~/stores/settings';
import { getClient } from '~/util/awclient';

// After reminding the user every SHORT_BACKOFF_PERIOD days for BACKOFF_THRESHOLD times, switch to LONG_BACKOFF_PERIOD
const BACKOFF_THRESHOLD = 5;

export default {
  name: 'new-release-notification',
  data() {
    return {
      isVisible: false,
      isFollowUpVisible: false,
      isSaving: false,
      currentVersion: null,
      latestVersion: null,
      latestVersionDate: null,
      // The following constants can be used in other files, such as ReleaseNotificationSettings.vue
      SHORT_BACKOFF_PERIOD: SHORT_BACKOFF_PERIOD,
      LONG_BACKOFF_PERIOD: LONG_BACKOFF_PERIOD,
    };
  },
  computed: {
    ...mapState(useSettingsStore, { data: 'newReleaseCheckData' }),
  },
  async mounted() {
    const settings = useSettingsStore();
    try {
      await settings.ensureLoaded();
    } catch (err) {
      console.error('Unable to load release notification settings:', err);
      return;
    }
    // Persist the initial deadline once, rather than moving it on every page load.
    if (!settings._storedKeys.includes('newReleaseCheckData')) {
      if (!(await this.saveData({ ...this.data }))) return;
    }
    if (this.data && (!this.data.isEnabled || moment() < moment(this.data.nextCheckTime))) return;

    await this.retrieveCurrentVersion();
    await this.retrieveLatestVersion();
    const isVisible = this.getHasNewRelease() && this.getReleaseIsReady();

    let data;
    if (isVisible && this.data) {
      const _timesChecked = Math.min(this.data.timesChecked + 1, BACKOFF_THRESHOLD);
      const _howOftenToCheck =
        _timesChecked > BACKOFF_THRESHOLD - 1 ? LONG_BACKOFF_PERIOD : SHORT_BACKOFF_PERIOD;
      data = {
        isEnabled: true,
        nextCheckTime: moment().add(_howOftenToCheck, 'seconds'),
        howOftenToCheck: _howOftenToCheck,
        timesChecked: _timesChecked,
      };
    } else {
      data = {
        isEnabled: true,
        nextCheckTime: moment().add(SHORT_BACKOFF_PERIOD, 'seconds'),
        howOftenToCheck: SHORT_BACKOFF_PERIOD,
        timesChecked: isVisible ? 1 : 0,
      };
    }
    if (await this.saveData(data)) this.isVisible = isVisible;
  },
  methods: {
    async saveData(data) {
      if (this.isSaving) return false;
      const settings = useSettingsStore();
      const previous = { ...settings.newReleaseCheckData };
      this.isSaving = true;
      try {
        await settings.update({ newReleaseCheckData: data });
        return true;
      } catch (err) {
        settings.$patch(state => {
          state.newReleaseCheckData = previous;
        });
        console.error('Unable to save release notification settings:', err);
        return false;
      } finally {
        this.isSaving = false;
      }
    },
    async retrieveCurrentVersion() {
      try {
        const response = await getClient().getInfo();
        this.currentVersion = this.cleanVersionTag(response.version);
      } catch (err) {
        console.error('unable to connect to aw-server: ', err);
      }
    },
    async retrieveLatestVersion() {
      try {
        const response = await axios.get(
          'https://api.github.com/repos/ActivityWatch/activitywatch/releases/latest'
        );
        this.latestVersion = this.cleanVersionTag(response.data.tag_name);
        this.latestVersionDate = moment(response.data.published_at);
      } catch (err) {
        console.error('unable to connect to GitHub API to check for latest version: ', err);
      }
    },
    cleanVersionTag(tag) {
      tag = tag.trim();

      // Remove the build metadata if it exists, e.g. 'v0.8.dev+c6433ea'
      const plus_idx = tag.indexOf('+');
      tag = tag.substring(0, plus_idx != -1 ? plus_idx : tag.length);
      // Remove server type if it exists, e.g. 'v0.8.0 (rust)'
      const space_idx = tag.indexOf(' ');
      tag = tag.substring(0, space_idx != -1 ? space_idx : tag.length);

      return semver.valid(tag);
    },
    getHasNewRelease() {
      // Null version means format was invalid, so fail silently and not show reminder
      if (this.currentVersion && this.latestVersion)
        return semver.lt(this.currentVersion, this.latestVersion);
      return false;
    },
    getReleaseIsReady() {
      // Want to make sure that the latest release is out for a week to make sure it's well tested
      if (this.latestVersionDate) return moment() >= this.latestVersionDate.add(7, 'days');
      return false;
    },
    async disableCheck() {
      if (!(await this.saveData({ ...this.data, isEnabled: false }))) return;
      this.isVisible = false;
      this.isFollowUpVisible = true;
    },
  },
};
</script>
