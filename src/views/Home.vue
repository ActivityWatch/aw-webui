<template lang="pug">
div
  b-alert(v-if="$isAndroid" show)
    | #[b {{ $t('home.note') }}] {{ $t('home.androidNote') }}

  b-alert.supporter-nudge(v-if="supporterNudgeVisible" show variant="success" dismissible @dismissed="snoozeSupporterNudge")
    span {{ $t('home.supporterNudge.message') }}
    b-button.ml-2(size="sm" variant="primary" href="https://activitywatch.net/go/?src=inapp-poweruser" target="_blank" @click="onSupporterNudgeSupport") {{ $t('home.supporterNudge.support') }}
    b-button.ml-1(size="sm" variant="link" @click="snoozeSupporterNudge") {{ $t('home.supporterNudge.notNow') }}

  h3 {{ $t('home.greeting') }}
  p
    | {{ homeIntro1 }}
  p
    | {{ $t('home.intro3') }}
  p.mb-0 {{ $t('home.thanks') }}
  p
    a(href="https://activitywatch.net/go/?src=inapp-survey&to=survey") {{ $t('home.surveyFill') }}
    | &nbsp;{{ $t('home.surveyOr') }}&nbsp;
    a(href="https://activitywatch.net/go/?src=inapp-forum&to=forum") {{ $t('home.voteForum') }}
    | &nbsp;{{ $t('home.surveySuffix') }}

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.spreadTitle') }}
      p
        | {{ $t('home.spread1') }}
      ul
        li
          | {{ $t('home.spreadReview') }}
          |  #[a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo]
        li
          | {{ $t('home.spreadVote') }}
          |  #[a(href="https://www.producthunt.com/posts/activitywatch") ProductHunt]
        li
          | {{ $t('home.spreadFollow') }}
          |  #[a(href="https://twitter.com/ActivityWatchIt") Twitter]
          |  /
          |  #[a(href="https://www.facebook.com/ActivityWatch") Facebook]
        li
          | {{ $t('home.spreadStar') }}
          |  #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]

    div.col-md-6
      h4 {{ $t('home.supportTitle') }}
      p
        | {{ $t('home.subscribeIntro') }}
        |  #[a(href="https://activitywatch.net/go/?src=inapp-home") {{ $t('home.subscribeCta') }}]
      p
        | {{ $t('home.support1') }}
      ul
        li #[a(href="https://www.patreon.com/erikbjare") Patreon]
        li #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li #[a(href="https://liberapay.com/ActivityWatch/") Liberapay]
        li #[a(href="https://activitywatch.net/donate/") {{ $t('home.otherDonationMethods') }}]
      p
        | {{ $t('home.support2') }}
        |  #[a(href="https://activitywatch.net/donate/") {{ $t('home.donationPage') }}].

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.resourcesTitle') }}
      ul
        li #[a(href="https://activitywatch.net/") {{ $t('home.website') }}]
        li #[a(href="https://docs.activitywatch.net/") {{ $t('home.documentation') }}]
        li #[a(href="https://forum.activitywatch.net/") {{ $t('home.forum') }}]
        li #[a(href="https://discord.gg/vDskV9q") {{ $t('home.discord') }}]
        li #[a(href="https://www.reddit.com/r/activitywatch/") {{ $t('home.reddit') }}]
        li #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
        li(v-if="!info.version.includes('rust')") #[a(:href="apiBrowserUrl") {{ $t('home.apiBrowser') }}]

    div.col-md-6
      h4 {{ $t('home.workingOnTitle') }}
      p
        | {{ $t('home.workingOnPrefix') }}
        |  #[a(href="https://forum.activitywatch.net/c/news") {{ $t('home.devUpdates') }}]
        |  {{ $t('home.workingOnMiddle') }}
        |  #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
        |  {{ $t('home.workingOnSuffix') }}

  hr

  p
    small
      i
        | {{ $t('home.landingHint') }}
        |  #[router-link(to="/settings") {{ $t('nav.settings') }}].

</template>

<script lang="ts">
import moment from 'moment';
import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';
import { IBucket } from '~/util/interfaces';

// "Support ActivityWatch" nudge — engagement-gated, dismissable, never modal.
// Shown only to clearly-engaged users so casual/new users are never nagged.
// All computation stays local; the app phones home nothing.
const SUPPORTER_NUDGE_DISMISS_KEY = 'aw-supporter-nudge-dismissed-until';
const SUPPORTER_FLAG_KEY = 'aw-supporter'; // honor-system "I already support" flag
const SNOOZE_DAYS = 90;
const INSTALL_AGE_DAYS = 30;
const POWER_USER_MIN_BUCKETS = 6;
const POWER_USER_MIN_HOSTS = 2;
const AFFINITY_MIN_SECONDS = 2 * 60 * 60; // ~2h of logged ActivityWatch time
const AFFINITY_LOOKBACK_DAYS = 90;

export default {
  name: 'Home',
  data() {
    return {
      supporterNudgeVisible: false,
    };
  },
  computed: {
    ...mapState(useServerStore, ['info']),
    homeIntro1() {
      const android = this.$isAndroid ? this.$t('home.introAndroid') : '';
      return this.$t('home.intro1', { android });
    },
    apiBrowserUrl(): string {
      const base = window.location.pathname.replace(/[^/]*$/, '');
      return base + 'api/';
    },
  },
  mounted() {
    // Best-effort: must never block or break the Home render.
    this.evaluateSupporterNudge();
  },
  methods: {
    async evaluateSupporterNudge(): Promise<void> {
      try {
        if (this.isSupporterNudgeSnoozed() || this.isSupporter()) return;

        const bucketsStore = useBucketsStore();
        await bucketsStore.ensureLoaded();
        const buckets = bucketsStore.buckets as IBucket[];
        if (!buckets || buckets.length === 0) return;

        // Cheap, synchronous signals first (install age + power-user setup).
        if (this.hasEngagementSignal(buckets)) {
          this.supporterNudgeVisible = true;
          return;
        }

        // ActivityWatch-affinity signal — best-effort, never blocks render.
        const hasAffinity = await this.hasActivityWatchAffinity(buckets).catch(() => false);
        if (hasAffinity) this.supporterNudgeVisible = true;
      } catch (e) {
        // Swallow: the nudge is entirely optional, Home must still render.
        console.warn('Supporter nudge evaluation skipped:', e);
      }
    },

    isSupporterNudgeSnoozed(): boolean {
      try {
        const raw = localStorage.getItem(SUPPORTER_NUDGE_DISMISS_KEY);
        if (!raw) return false;
        const until = new Date(raw).getTime();
        return !isNaN(until) && until > Date.now();
      } catch {
        return false;
      }
    },

    isSupporter(): boolean {
      try {
        return localStorage.getItem(SUPPORTER_FLAG_KEY) === 'true';
      } catch {
        return false;
      }
    },

    // Signals 1 & 2 — derivable synchronously from getBuckets().
    hasEngagementSignal(buckets: IBucket[]): boolean {
      // Signal 1 (primary, cheapest): install age >= 30 days, from the
      // earliest `created` timestamp across all buckets.
      const createds = buckets
        .map(b => (b.created ? new Date(b.created as unknown as string).getTime() : NaN))
        .filter(t => !isNaN(t));
      if (createds.length > 0) {
        const earliest = Math.min(...createds);
        const ageDays = (Date.now() - earliest) / (1000 * 60 * 60 * 24);
        if (ageDays >= INSTALL_AGE_DAYS) return true;
      }

      // Signal 2: power-user setup — many buckets OR multi-host/multi-watcher.
      if (buckets.length >= POWER_USER_MIN_BUCKETS) return true;
      const hostnames = new Set(buckets.map(b => b.hostname).filter(Boolean));
      if (hostnames.size >= POWER_USER_MIN_HOSTS) return true;

      return false;
    },

    // Signal 3 — ActivityWatch affinity (dogfooder/contributor).
    // Sums logged window time whose app/title matches "activitywatch".
    // Reuses the existing aw-client query infra; all local. Best-effort.
    async hasActivityWatchAffinity(buckets: IBucket[]): Promise<boolean> {
      const windowBuckets = buckets
        .filter(b => b.type === 'currentwindow' && !b.id.startsWith('aw-watcher-android'))
        .map(b => b.id.replace(/"/g, '\\"'));
      if (windowBuckets.length === 0) return false;

      const end = moment();
      const start = moment().subtract(AFFINITY_LOOKBACK_DAYS, 'days');
      const period = `${start.format()}/${end.format()}`;

      const query: string[] = ['events = [];'];
      for (const id of windowBuckets) {
        query.push(`events = concat(events, query_bucket("${id}"));`);
      }
      query.push(
        // (?i) = case-insensitive match, mirroring /activitywatch/i.
        'app_events = filter_keyvals_regex(events, "app", "(?i)activitywatch");',
        'title_events = filter_keyvals_regex(events, "title", "(?i)activitywatch");',
        // union_no_overlap dedups events matching both app and title.
        'matched = union_no_overlap(app_events, title_events);',
        'RETURN = sum_durations(matched);'
      );

      const result = await getClient().query([period], query, { name: 'supporterAffinity' });
      const seconds = Array.isArray(result) ? result[0] : result;
      return typeof seconds === 'number' && seconds >= AFFINITY_MIN_SECONDS;
    },

    onSupporterNudgeSupport(): void {
      // They've engaged with the ask — snooze so we don't re-nag on return.
      this.snoozeSupporterNudge();
    },

    snoozeSupporterNudge(): void {
      this.supporterNudgeVisible = false;
      try {
        const until = moment().add(SNOOZE_DAYS, 'days').toISOString();
        localStorage.setItem(SUPPORTER_NUDGE_DISMISS_KEY, until);
      } catch {
        // localStorage unavailable — nudge simply reappears next load.
      }
    },
  },
};
</script>
