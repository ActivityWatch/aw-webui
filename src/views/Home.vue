<template lang="pug">
div
  b-alert(v-if="$isAndroid" show)
    | #[b {{ $t('home.note') }}] {{ $t('home.androidNote') }}

  b-alert.supporter-nudge(v-if="supporterNudgeVisible" show variant="success" dismissible @dismissed="snoozeSupporterNudge")
    span {{ $t('home.supporterNudge.message') }}
    b-button.ml-2(size="sm" variant="primary" :href="supporterNudgeHref" target="_blank" @click="onSupporterNudgeSupport") {{ $t('home.supporterNudge.support') }}
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

// Signal 1 — install tenure.
const INSTALL_AGE_DAYS = 30;
// Signal 2 — power-user setup.
const POWER_USER_MIN_BUCKETS = 6;
const POWER_USER_MIN_HOSTS = 2;
// Signal 3 — retention / regular use: several active days across the month.
const RETENTION_LOOKBACK_DAYS = 30;
const ACTIVE_DAY_MIN_MINUTES = 10; // a day counts as "active" above this much not-afk time
const ACTIVE_DAYS_THRESHOLD = 8; // trigger if >= this many active days in the lookback

// GA src tags, one per triggering signal, so the /go/ redirect reveals which
// indicator actually converts. Support-button src = the highest-priority
// matching signal (most -> least predictive of paying): regular > setup > tenure.
const SRC_TENURE = 'inapp-tenure';
const SRC_SETUP = 'inapp-setup';
const SRC_REGULAR = 'inapp-regular';

export default {
  name: 'Home',
  data() {
    return {
      supporterNudgeVisible: false,
      supporterNudgeSrc: '',
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
    supporterNudgeHref(): string {
      return `https://activitywatch.net/go/?src=${this.supporterNudgeSrc}`;
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

        // Cheap, synchronous signals first (setup checked before tenure, since
        // setup ranks higher when both match).
        const syncTag = this.syncEngagementTag(buckets);
        if (syncTag) {
          this.showSupporterNudge(syncTag);
          return;
        }

        // Retention signal — best-effort, never blocks render.
        const isRegular = await this.hasRegularUsage(buckets).catch(() => false);
        if (isRegular) this.showSupporterNudge(SRC_REGULAR);
      } catch (e) {
        // Swallow: the nudge is entirely optional, Home must still render.
        console.warn('Supporter nudge evaluation skipped:', e);
      }
    },

    showSupporterNudge(src: string): void {
      this.supporterNudgeSrc = src;
      this.supporterNudgeVisible = true;
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
    // Returns the winning src tag (setup outranks tenure) or null.
    syncEngagementTag(buckets: IBucket[]): string | null {
      // Signal 2: power-user setup — many buckets OR multi-host/multi-watcher.
      // Checked first: outranks tenure when both match.
      const hostnames = new Set(buckets.map(b => b.hostname).filter(Boolean));
      if (buckets.length >= POWER_USER_MIN_BUCKETS || hostnames.size >= POWER_USER_MIN_HOSTS) {
        return SRC_SETUP;
      }

      // Signal 1 (cheapest): install age >= 30 days, from the earliest
      // `created` timestamp across all buckets.
      const createds = buckets
        .map(b => (b.created ? new Date(b.created as unknown as string).getTime() : NaN))
        .filter(t => !isNaN(t));
      if (createds.length > 0) {
        const earliest = Math.min(...createds);
        const ageDays = (Date.now() - earliest) / (1000 * 60 * 60 * 24);
        if (ageDays >= INSTALL_AGE_DAYS) return SRC_TENURE;
      }

      return null;
    },

    // Signal 3 — retention / regular use. Counts days in the last 30 with at
    // least ACTIVE_DAY_MIN_MINUTES of not-afk (active) time. Reuses the same
    // aw-client query2 infra; all local. Best-effort.
    async hasRegularUsage(buckets: IBucket[]): Promise<boolean> {
      const escape = (id: string) => id.replace(/"/g, '\\"');
      const afkBuckets = buckets.filter(b => b.type === 'afkstatus').map(b => escape(b.id));
      const androidBuckets = buckets
        .filter(b => b.type === 'currentwindow' && b.id.startsWith('aw-watcher-android'))
        .map(b => escape(b.id));

      // Per-day not-afk seconds. On desktop, sum not-afk time from afk buckets;
      // on Android (no afk buckets) treat all logged window time as active.
      let query: string[];
      if (afkBuckets.length > 0) {
        query = ['not_afk = [];'];
        for (const id of afkBuckets) {
          query.push(`not_afk_curr = query_bucket("${id}");`);
          query.push('not_afk_curr = filter_keyvals(not_afk_curr, "status", ["not-afk"]);');
          query.push('not_afk = union_no_overlap(not_afk, not_afk_curr);');
        }
        query.push('RETURN = sum_durations(not_afk);');
      } else if (androidBuckets.length > 0) {
        query = ['events = [];'];
        for (const id of androidBuckets) {
          query.push(`events = concat(events, query_bucket("${id}"));`);
        }
        query.push('RETURN = sum_durations(events);');
      } else {
        return false;
      }

      // One day-long period per day in the lookback window.
      const periods: string[] = [];
      for (let i = 0; i < RETENTION_LOOKBACK_DAYS; i++) {
        const dayStart = moment().subtract(i, 'days').startOf('day');
        periods.push(`${dayStart.format()}/${dayStart.clone().add(1, 'day').format()}`);
      }

      const results = await getClient().query(periods, query, { name: 'supporterRetention' });
      const minSeconds = ACTIVE_DAY_MIN_MINUTES * 60;
      const activeDays = (Array.isArray(results) ? results : []).filter(
        (s: unknown) => typeof s === 'number' && s >= minSeconds
      ).length;
      return activeDays >= ACTIVE_DAYS_THRESHOLD;
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
