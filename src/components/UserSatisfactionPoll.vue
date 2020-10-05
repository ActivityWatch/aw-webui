<template lang="pug">
  div
    b-alert(v-if="isPollVisible", variant="info", show)
      button(type="button", class="close", @click="isPollVisible=false") &times;
      form
        p
          | Hey there! You've been using ActivityWatch for a while. How likely are you to recommend it to a friend/colleague (10 being most likely)?
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
      | We're really happy to hear you are enjoying ActivityWatch, but we think we can do even better! To help us help you, here are a few things you can do:
      ul
        li
          | Support us on #[a(href="https://www.patreon.com/erikbjare") Patreon] or #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li 
          | If you're using ActivityWatch in the workplace, consider asking your employer to support us!
        li 
          | Tell your friends and coworkers! Post about it on social media, we are on #[a(href="https://twitter.com/ActivityWatchIt") Twitter] and #[a(href="https://www.facebook.com/ActivityWatch") Facebook]
        li 
          | Sign up for the newsletter
        li 
          | Vote for new features on the #[a(href="https://forum.activitywatch.net/c/features") forum]
        li 
          | Fill out the #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") feedback form]
        li 
          | Rate us on #[a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo]
        li 
          | Star us on #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]

    b-alert(v-if="isNegFollowUpVisible", variant="info" show)
      button(type="button", class="close", @click="isNegFollowUpVisible=false") &times;
      | We are sorry to hear that you did not enjoy using ActivityWatch, but we want to improve! We would be vary thankful if you help us by:
      ul
        li
          | Fill out the #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") feedback form]
        li
          | Vote for new features on the #[a(href="https://forum.activitywatch.net/c/features") forum]
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
import moment from 'moment';

const NUM_OPTIONS = 10;
// INITIAL_WAIT_PERIOD is how long to wait from initialTimestamp to the first time that the poll shows up
const INITIAL_WAIT_PERIOD = 30 * 24 * 60 * 60;
// BACKOFF_PERIOD is how many seconds to wait to show the poll again if the user closed it
const BACKOFF_PERIOD = 24 * 60 * 60;
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
      options: Array.from({ length: NUM_OPTIONS }, (_, i) => i + 1),
      rating: null,
      data: null,
    };
  },
  mounted() {
    // Check if initialTimestamp (first time that the user runs the web app) exists
    let initialTimestamp = moment();
    if (localStorage.initialTimestamp) {
      initialTimestamp = moment(localStorage.initialTimestamp);
    } else {
      localStorage.initialTimestamp = initialTimestamp;
    }

    // Get the rest of the data
    this.retrieveData();
    if (!this.data) {
      this.data = {
        isEnabled: true,
        nextPollTime: initialTimestamp.add(INITIAL_WAIT_PERIOD, 'seconds'),
        timesPollIsShown: 0,
      };
      this.saveData();
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

    this.saveData();
  },
  methods: {
    retrieveData() {
      if (localStorage.getItem('userSatisfactionPollData')) {
        try {
          this.data = JSON.parse(localStorage.getItem('userSatisfactionPollData'));
        } catch (err) {
          console.error('userSatisfactionPollData not found in localStorage: ', err);
          localStorage.removeItem('userSatisfactionPollData');
        }
      }
    },
    saveData() {
      const parsed = JSON.stringify(this.data);
      localStorage.setItem('userSatisfactionPollData', parsed);
    },
    submit() {
      this.isPollVisible = false;
      this.data.isEnabled = false;
      this.saveData();
      if (parseInt(this.rating) >= 6) {
        this.isPosFollowUpVisible = true;
      } else {
        this.isNegFollowUpVisible = true;
      }
    },
    dontShowAgain() {
      this.isPollVisible = false;
      this.data.isEnabled = false;
      this.saveData();
    },
  },
};
</script>
