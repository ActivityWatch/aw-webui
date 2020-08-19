<template lang="pug">
  div
    b-alert(v-if="isVisible", variant="info", show)
      | A new release, v{{ latestVersion }}, is available for 
      | #[a(href="https://activitywatch.net/downloads/" target="_blank" class="alert-link") download], 
      | you can also #[a(href="javascript:void(0);" class="alert-link" @click="disableCheck") disable]
      | future reminders and checks for updates.
      button(type="button", class="close", @click="isVisible=false") &times;

    b-alert(v-if="isFollowUpVisible", variant="success", show)
      | Checking for new releases is now disabled, you can re-enable it in the 
      | #[router-link(to="/settings" class="alert-link" @click.native="isFollowUpVisible=false") settings page].
      button(type="button", class="close", @click="isFollowUpVisible=false") &times;
</template>

<script>
import axios from 'axios';
import moment from 'moment';
import semver from 'semver';

const SHORT_BACKOFF_PERIOD = 24 * 60 * 60;
const LONG_BACKOFF_PERIOD = 5 * 24 * 60 * 60;
// After reminding the user every SHORT_BACKOFF_PERIOD days for BACKOFF_THRESHOLD times, switch to LONG_BACKOFF_PERIOD
const BACKOFF_THRESHOLD = 5;
// The following may be used for testing, roughly 10s and 30s each
// const SHORT_BACKOFF_PERIOD = 10;
// const LONG_BACKOFF_PERIOD = 30;

export default {
  name: 'new-release-notification',
  data() {
    return {
      isVisible: false,
      isFollowUpVisible: false,
      data: null, // data should have isEnabled, nextCheckTime, howOftenToCheck, timesChecked
      currentVersion: null,
      latestVersion: null,
      latestVersionDate: null,
      // The following constants can be used in other files, such as ReleaseNotificationSettings.vue
      SHORT_BACKOFF_PERIOD: SHORT_BACKOFF_PERIOD,
      LONG_BACKOFF_PERIOD: LONG_BACKOFF_PERIOD,
    };
  },
  async mounted() {
    this.retrieveData();
    if (this.data && (!this.data.isEnabled || moment() < moment(this.data.nextCheckTime))) return;

    await this.retrieveCurrentVersion();
    await this.retrieveLatestVersion();
    this.isVisible = this.getHasNewRelease() && this.getReleaseIsReady();

    if (this.isVisible && this.data) {
      const _timesChecked = Math.min(this.data.timesChecked + 1, BACKOFF_THRESHOLD);
      const _howOftenToCheck =
        _timesChecked > BACKOFF_THRESHOLD - 1 ? LONG_BACKOFF_PERIOD : SHORT_BACKOFF_PERIOD;
      this.data = {
        isEnabled: true,
        nextCheckTime: moment().add(_howOftenToCheck, 'seconds'),
        howOftenToCheck: _howOftenToCheck,
        timesChecked: _timesChecked,
      };
    } else {
      this.data = {
        isEnabled: true,
        nextCheckTime: moment().add(SHORT_BACKOFF_PERIOD, 'seconds'),
        howOftenToCheck: SHORT_BACKOFF_PERIOD,
        timesChecked: this.isVisible ? 1 : 0,
      };
    }

    this.saveData();
  },
  methods: {
    retrieveData() {
      if (localStorage.getItem('newReleaseCheckData')) {
        try {
          this.data = JSON.parse(localStorage.getItem('newReleaseCheckData'));
        } catch (err) {
          console.error('newReleaseCheckData not found in localStorage: ', err);
          localStorage.removeItem('newReleaseCheckData');
        }
      }
    },
    async retrieveCurrentVersion() {
      try {
        const response = await this.$aw.getInfo();
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
    saveData() {
      const parsed = JSON.stringify(this.data);
      localStorage.setItem('newReleaseCheckData', parsed);
    },
    disableCheck() {
      this.isVisible = false;
      this.isFollowUpVisible = true;
      this.data.isEnabled = false;
      this.saveData();
    },
  },
};
</script>
