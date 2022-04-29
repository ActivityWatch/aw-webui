<template lang="pug">
  div
    b-alert(v-if="isPollVisible", variant="info", show)
      button(type="button", class="close", @click="isPollVisible=false") &times;
      form
        p
          | Hey there! You've been using ActivityWatch for a while. How likely are you to recommend it to a friend/colleague on a scale 1-10? (with 10 being the most likely)
        div(class="radio-options")
          div(v-for="i in options", class="option-group")
            input(type="radio", :id="'option' + i", name="rating", :value="i", v-model="rating")
            br
            label(:for="'option' + i", style="display: block")
              | {{ i }}
      div(style="display: flex; justify-content: space-between")
        a(@click="dontShowAgain" href="#")
          | Don't show again
        input(type="submit" value="Submit" @click="submit")

    b-alert(v-if="isPosFollowUpVisible", variant="info" show)
      button(type="button", class="close", @click="isPosFollowUpVisible=false") &times;
      p
        | We're happy to hear you enjoy using ActivityWatch, but we can do better!
        br
        | To help us help you, here are a few things you can do:
      ul.small
        li
          | Support us on #[a(href="https://www.patreon.com/erikbjare") Patreon] or #[a(href="https://opencollective.com/activitywatch") Open Collective] (or by #[a(href="https://activitywatch.net/donate/") other donation methods]).
        li
          | Tell your friends and colleagues!
        li
          | Post about it on social media, we are on #[a(href="https://twitter.com/ActivityWatchIt") Twitter] and #[a(href="https://www.facebook.com/ActivityWatch") Facebook].
        //li
          | Fill out the #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") feedback form].
        li
          | Rate us on #[a(href="https://alternativeto.net/software/activitywatch/about/") AlternativeTo] and #[a(href="https://play.google.com/store/apps/details?id=net.activitywatch.android") Google Play Store].
        li
          | Join our #[a(href="https://discord.gg/vDskV9q") Discord server].
        li
          | Sign up for the #[a(href="http://eepurl.com/cTU6QX") newsletter] (we rarely send anything).

    b-alert(v-if="isNegFollowUpVisible", variant="info" show)
      button(type="button", class="close", @click="isNegFollowUpVisible=false") &times;
      | We are sorry to hear that you did not like ActivityWatch, but we want to improve! We would be very thankful if you helped us by:
      ul
        li
          | Fill out the #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") feedback form].
        li
          | Vote for new features on the #[a(href="https://forum.activitywatch.net/c/features") forum].
</template>

<style scoped>
.radio-options {
  display: flex;
  justify-content: space-around;
}

.option-group {
  text-align: center;
}

ul {
  margin: 0;
}
</style>

<script>
import { range } from 'lodash/fp';
import moment from 'moment';

import { useSettingsStore } from '~/stores/settings';

const NUM_OPTIONS = 10;
// INITIAL_WAIT_PERIOD is how long to wait from initialTimestamp to the first time that the poll shows up
const INITIAL_WAIT_PERIOD = 7 * 24 * 60 * 60;
// BACKOFF_PERIOD is how many seconds to wait to show the poll again if the user closed it
const BACKOFF_PERIOD = 7 * 24 * 60 * 60;
// The following may be used for testing
// const INITIAL_WAIT_PERIOD = 1;
// const BACKOFF_PERIOD = 1;

export default {
  name: 'user-satisfaction-poll',
  data() {
    return {
      isPollVisible: false,
      isPosFollowUpVisible: false,
      isNegFollowUpVisible: false,
      // options is an array of [1, ..., NUM_OPTIONS]
      options: range(1, NUM_OPTIONS + 1),
      rating: null,
    };
  },
  computed: {
    data: {
      get() {
        const settingsStore = useSettingsStore();
        return settingsStore.userSatisfactionPollData;
      },
      set(value) {
        const settingsStore = useSettingsStore();
        const data = settingsStore.userSatisfactionPollData;
        settingsStore.update({
          userSatisfactionPollData: { ...data, ...value },
        });
      },
    },
  },
  async mounted() {
    // Get the rest of the data
    const settingsStore = useSettingsStore();
    if (!this.data) {
      this.data = {
        isEnabled: true,
        nextPollTime: settingsStore.initialTimestamp.add(INITIAL_WAIT_PERIOD, 'seconds'),
        timesPollIsShown: 0,
      };
    }

    if (!this.data.isEnabled) {
      return;
    }

    // Show poll if enough time has passed
    if (moment() >= moment(this.data.nextPollTime)) {
      this.data.timesPollIsShown = this.data.timesPollIsShown + 1;
      this.isPollVisible = true;
      this.data.nextPollTime = moment().add(BACKOFF_PERIOD, 'seconds');
    }

    // Show the poll a maximum of 3 times
    if (this.data.timesPollIsShown > 2) {
      this.data.isEnabled = false;
    }
  },
  methods: {
    submit() {
      this.isPollVisible = false;
      const data = this.data;
      data.isEnabled = false;
      this.data = data;

      if (parseInt(this.rating) >= 6) {
        this.isPosFollowUpVisible = true;
      } else {
        this.isNegFollowUpVisible = true;
      }
    },
    dontShowAgain() {
      this.isPollVisible = false;
      const data = this.data;
      data.isEnabled = false;
      this.data = data;
    },
  },
};
</script>
