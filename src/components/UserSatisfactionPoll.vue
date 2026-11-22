<template lang="pug">
  div
    //- Rendered inside the notice host's modal, so it never shifts the page layout.
    //- A routing prompt, not a survey: no score is collected, the choice only picks what we show next.
    div(v-if="isPollVisible", data-testid="poll-ask")
      p {{ $t('ui.userPoll.askQuestion') }}
      div.d-flex.flex-column.flex-sm-row
        b-button.mb-2.mr-sm-2(variant="success", data-testid="poll-positive", :disabled="isSaving", @click="choose(true)")
          | {{ $t('ui.userPoll.workingWell') }}
        b-button.mb-2(variant="outline-secondary", data-testid="poll-negative", :disabled="isSaving", @click="choose(false)")
          | {{ $t('ui.userPoll.couldBeBetter') }}
      div.d-flex.justify-content-between.small
        b-button.p-0(variant="link", size="sm", data-testid="poll-not-now", @click="notNow")
          | {{ $t('ui.userPoll.notNow') }}
        b-button.p-0(variant="link", size="sm", data-testid="poll-dont-ask", :disabled="isSaving", @click="dontShowAgain")
          | {{ $t('ui.userPoll.dontShowAgain') }}

    div(v-if="isPosFollowUpVisible", data-testid="poll-positive-step")
      p
        | {{ $t('ui.userPoll.positiveIntro') }}
      ul.small
        li
          | {{ $t('ui.userPoll.support') }} #[a(:href="goUrl('inapp-poll')" target="_blank" data-testid="poll-support") {{ $t('ui.userPoll.supportLink') }}]
        li
          | {{ $t('ui.userPoll.rate') }} #[a(href="https://alternativeto.net/software/activitywatch/about/" target="_blank") AlternativeTo] / #[a(href="https://play.google.com/store/apps/details?id=net.activitywatch.android" target="_blank") Google Play Store]
      details.small
        summary {{ $t('ui.userPoll.moreWays') }}
        ul.mt-1
          li
            | {{ $t('ui.userPoll.tellFriends') }}
          li
            | {{ $t('ui.userPoll.social') }} #[a(href="https://twitter.com/ActivityWatchIt" target="_blank") Twitter] / #[a(href="https://www.facebook.com/ActivityWatch" target="_blank") Facebook]
          li
            | {{ $t('ui.userPoll.join') }} #[a(href="https://discord.gg/vDskV9q" target="_blank") Discord]
          li
            | {{ $t('ui.userPoll.newsletter') }} #[a(href="http://eepurl.com/cTU6QX" target="_blank") newsletter]

    div(v-if="isNegFollowUpVisible", data-testid="poll-negative-step")
      p
        | {{ $t('ui.userPoll.negativeIntro') }}
      ul
        li
          | {{ $t('ui.userPoll.feedback') }} #[a(:href="goUrl('inapp-survey', 'survey')" target="_blank" data-testid="poll-feedback") {{ $t('ui.userPoll.feedbackForm') }}]
        li
          | {{ $t('ui.userPoll.vote') }} #[a(:href="goUrl('inapp-forum', 'forum')" target="_blank") {{ $t('ui.userPoll.forum') }}]
</template>

<script lang="ts">
import moment from 'moment';
import { mapState } from 'pinia';

import { useSettingsStore } from '~/stores/settings';
import { useNoticesStore } from '~/stores/notices';

const NOTICE_ID = 'poll';
// How long the user must stay on the page before the poll may open on its own, once per page load.
const DWELL_MS = 8000;
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
      isSaving: false,
      dwellTimer: null,
    };
  },
  computed: {
    ...mapState(useSettingsStore, { data: 'userSatisfactionPollData' }),
    ...mapState(useNoticesStore, { hostOpen: 'isOpen' }),
    hasNotice() {
      return this.isPollVisible || this.isPosFollowUpVisible || this.isNegFollowUpVisible;
    },
  },
  watch: {
    // The bell shows a dot while the poll is waiting; it opens on its own at most once per page load.
    hasNotice(has) {
      const notices = useNoticesStore();
      if (has) notices.publish(NOTICE_ID);
      else notices.withdraw(NOTICE_ID);
    },
    isPollVisible(visible) {
      if (visible) this.scheduleSpontaneousOpen();
      else this.cancelDwell();
    },
    // Once the user has closed the host the follow-up has been seen: stop listing it.
    hostOpen(isOpen) {
      this.cancelDwell();
      if (!isOpen) {
        this.isPosFollowUpVisible = false;
        this.isNegFollowUpVisible = false;
      }
    },
  },
  beforeDestroy() {
    this.cancelDwell();
    useNoticesStore().withdraw(NOTICE_ID);
  },
  async mounted() {
    const settings = useSettingsStore();
    try {
      await settings.ensureLoaded();
    } catch (err) {
      console.error('Unable to load satisfaction poll settings:', err);
      return;
    }
    if (!settings._storedKeys.includes('userSatisfactionPollData')) {
      if (!(await this.saveData({ ...this.data }))) return;
    }
    if (!this.data.isEnabled) {
      return;
    }

    // Show the poll a maximum of 3 times.
    if (this.data.timesPollIsShown >= 3) {
      await this.saveData({ ...this.data, isEnabled: false });
      return;
    }

    // Show poll if enough time has passed
    if (moment() >= moment(this.data.nextPollTime)) {
      const timesPollIsShown = this.data.timesPollIsShown + 1;
      if (
        await this.saveData({
          ...this.data,
          timesPollIsShown,
          nextPollTime: moment().add(BACKOFF_PERIOD, 'seconds'),
          isEnabled: timesPollIsShown < 3,
        })
      ) {
        this.isPollVisible = true;
      }
    }
  },
  methods: {
    async saveData(data) {
      if (this.isSaving) return false;
      const settings = useSettingsStore();
      const previous = { ...settings.userSatisfactionPollData };
      this.isSaving = true;
      try {
        await settings.update({ userSatisfactionPollData: data });
        return true;
      } catch (err) {
        settings.$patch(state => {
          state.userSatisfactionPollData = previous;
        });
        console.error('Unable to save satisfaction poll settings:', err);
        return false;
      } finally {
        this.isSaving = false;
      }
    },
    scheduleSpontaneousOpen() {
      this.cancelDwell();
      // Already opened (and possibly closed again) by the user: do not reopen it later.
      if (useNoticesStore().isOpen) return;
      this.dwellTimer = setTimeout(() => {
        this.dwellTimer = null;
        if (this.isPollVisible) useNoticesStore().open();
      }, DWELL_MS);
    },
    cancelDwell() {
      if (this.dwellTimer) clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
    },
    goUrl(src, to) {
      return `https://activitywatch.net/go/?src=${src}${to ? `&to=${to}` : ''}`;
    },
    // Answering ends the poll for good (it was already counted as shown); the answer only routes.
    async choose(positive) {
      if (!(await this.saveData({ ...this.data, isEnabled: false }))) return;
      this.isPollVisible = false;
      // The host may have been closed while saving; that dismisses the follow-up too.
      if (!useNoticesStore().isOpen) return;
      if (positive) this.isPosFollowUpVisible = true;
      else this.isNegFollowUpVisible = true;
    },
    // Closes without answering; the 7-day backoff set when it was shown still applies.
    notNow() {
      this.isPollVisible = false;
      useNoticesStore().close();
    },
    async dontShowAgain() {
      if (!(await this.saveData({ ...this.data, isEnabled: false }))) return;
      this.isPollVisible = false;
      useNoticesStore().close();
    },
  },
};
</script>
