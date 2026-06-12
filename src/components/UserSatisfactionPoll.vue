<template lang="pug">
  div
    b-alert(v-if="isPollVisible", variant="info", show)
      button(type="button", class="close", @click="isPollVisible=false") &times;
      form
        p
          | {{ $t('poll.prompt') }}
        div(class="radio-options")
          div(v-for="i in options", class="option-group")
            input(type="radio", :id="'option' + i", name="rating", :value="i", v-model="rating")
            br
            label(:for="'option' + i", style="display: block")
              | {{ i }}
      div(style="display: flex; justify-content: space-between")
        a(@click="dontShowAgain" href="#")
          | {{ $t('poll.dontShowAgain') }}
        input(type="submit" :value="$t('poll.submit')" @click="submit")

    b-alert(v-if="isPosFollowUpVisible", variant="info" show)
      button(type="button", class="close", @click="isPosFollowUpVisible=false") &times;
      p
        | {{ $t('poll.positiveIntro') }}
        br
        | {{ $t('poll.positiveHelp') }}
      ul.small
        li
          | {{ $t('poll.supportBefore') }}#[a(href="https://www.patreon.com/erikbjare") Patreon]{{ $t('poll.supportBetween') }}#[a(href="https://opencollective.com/activitywatch") Open Collective]{{ $t('poll.supportAfter') }}#[a(href="https://activitywatch.net/donate/") {{ $t('poll.otherDonationMethods') }}]{{ $t('poll.supportEnd') }}
        li
          | {{ $t('poll.tellFriends') }}
        li
          | {{ $t('poll.postBefore') }}#[a(href="https://twitter.com/ActivityWatchIt") Twitter]{{ $t('poll.postBetween') }}#[a(href="https://www.facebook.com/ActivityWatch") Facebook]{{ $t('poll.sentenceEnd') }}
        //li
          | Fill out the #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") feedback form].
        li
          | {{ $t('poll.rateBefore') }}#[a(href="https://alternativeto.net/software/activitywatch/about/") AlternativeTo]{{ $t('poll.rateBetween') }}#[a(href="https://play.google.com/store/apps/details?id=net.activitywatch.android") Google Play Store]{{ $t('poll.rateAfter') }}
        li
          | {{ $t('poll.joinBefore') }}#[a(href="https://discord.gg/vDskV9q") {{ $t('poll.discordServer') }}]{{ $t('poll.sentenceEnd') }}
        li
          | {{ $t('poll.signupBefore') }}#[a(href="http://eepurl.com/cTU6QX") {{ $t('poll.newsletter') }}]{{ $t('poll.signupAfter') }}

    b-alert(v-if="isNegFollowUpVisible", variant="info" show)
      button(type="button", class="close", @click="isNegFollowUpVisible=false") &times;
      | {{ $t('poll.negativeIntro') }}
      ul
        li
          | {{ $t('poll.feedbackBefore') }}#[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") {{ $t('poll.feedbackForm') }}]{{ $t('poll.sentenceEnd') }}
        li
          | {{ $t('poll.voteBefore') }}#[a(href="https://forum.activitywatch.net/c/features") {{ $t('poll.forum') }}]{{ $t('poll.voteAfter') }}
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

<script lang="ts">
import { range } from 'lodash/fp';
import moment from 'moment';

import { useSettingsStore } from '~/stores/settings';

const NUM_OPTIONS = 10;
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
      this.data = { ...this.data, isEnabled: false };

      if (parseInt(this.rating) >= 6) {
        this.isPosFollowUpVisible = true;
      } else {
        this.isNegFollowUpVisible = true;
      }
    },
    dontShowAgain() {
      this.isPollVisible = false;
      this.data = { ...this.data, isEnabled: false };
    },
  },
};
</script>
