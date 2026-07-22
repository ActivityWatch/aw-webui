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
// Signal 3 — retention / regular use: the user actively OPENS AND LOOKS AT the
// webui on several distinct days (real product engagement — they come back to
// check their data), tracked purely client-side (localStorage, no server query).
// NOTE: this accumulates only AFTER this feature ships (localStorage starts
// empty), so it is forward-looking: a brand-new install won't fire it for the
// first ~week of use. That's intended — install-age (tenure) and setup cover
// existing users retroactively; this one rewards ongoing engagement.
const ENGAGED_DAYS_KEY = 'aw-engaged-days'; // array of local YYYY-MM-DD dates
const ENGAGED_SECONDS_KEY = 'aw-engaged-seconds-today'; // partial accrual for today
const ENGAGED_DAY_MIN_SECONDS = 10; // active viewing today needed to count the day
const ENGAGED_DAYS_LOOKBACK_DAYS = 30;
const ENGAGED_DAYS_THRESHOLD = 5; // fire if >= this many engaged days in the lookback

// GA src tags, one per triggering signal, so the /go/ redirect reveals which
// indicator actually converts. Support-button src = the highest-priority
// matching signal (most -> least predictive of paying): regular > setup > tenure.
const SRC_TENURE = 'inapp-tenure';
const SRC_SETUP = 'inapp-setup';
const SRC_REGULAR = 'inapp-regular';

// Engagement-tracking state (module-scoped: only one Home is mounted at a time).
// "Active" = the webui tab is visible AND focused; we accumulate seconds while so.
let engagementActiveSince: number | null = null;
let engagementInterval: ReturnType<typeof setInterval> | null = null;
let engagementChangeHandler: (() => void) | null = null;
let supporterStorageHandler: ((event: StorageEvent) => void) | null = null;

function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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
    this.startSupporterStorageSync();
    // Track ongoing webui engagement (client-side only) for the retention signal.
    this.startEngagementTracking();
  },
  beforeDestroy() {
    this.stopSupporterStorageSync();
    this.stopEngagementTracking();
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

        // Retention signal — client-side localStorage check, never errors render.
        if (this.hasRegularEngagement()) this.showSupporterNudge(SRC_REGULAR);
      } catch (e) {
        // Swallow: the nudge is entirely optional, Home must still render.
        console.warn('Supporter nudge evaluation skipped:', e);
      }
    },

    showSupporterNudge(src: string): void {
      // Re-read shared state after async evaluation: another tab may have
      // snoozed the nudge or marked this user as a supporter in the meantime.
      if (this.isSupporterNudgeSnoozed() || this.isSupporter()) return;
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

    startSupporterStorageSync(): void {
      supporterStorageHandler = (event: StorageEvent) => {
        if (
          event.key === SUPPORTER_NUDGE_DISMISS_KEY ||
          event.key === SUPPORTER_FLAG_KEY ||
          event.key === null
        ) {
          if (this.isSupporterNudgeSnoozed() || this.isSupporter()) {
            this.supporterNudgeVisible = false;
          }
        }
      };
      window.addEventListener('storage', supporterStorageHandler);
    },

    stopSupporterStorageSync(): void {
      if (supporterStorageHandler) {
        window.removeEventListener('storage', supporterStorageHandler);
        supporterStorageHandler = null;
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

    // Signal 3 — retention / regular use. Purely client-side: fires if the
    // user has actively opened+viewed the webui on >= ENGAGED_DAYS_THRESHOLD
    // distinct days within the lookback window. No server query.
    hasRegularEngagement(): boolean {
      try {
        return this.readEngagedDaysWithinLookback().length >= ENGAGED_DAYS_THRESHOLD;
      } catch {
        return false;
      }
    },

    // Read the recorded engaged-day dates, pruned to the lookback window.
    readEngagedDaysWithinLookback(): string[] {
      let days: string[] = [];
      try {
        const raw = localStorage.getItem(ENGAGED_DAYS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) days = parsed.filter(d => typeof d === 'string');
        }
      } catch {
        return [];
      }
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - ENGAGED_DAYS_LOOKBACK_DAYS);
      const cutoffStr = localDateStr(cutoff);
      // YYYY-MM-DD sorts lexicographically by date; keep unique in-window dates.
      return [...new Set(days)].filter(d => d >= cutoffStr).sort();
    },

    // --- Client-side engagement tracking -------------------------------------
    // "Active" = the webui tab is visible (Page Visibility API) AND focused.
    // We accumulate active seconds for today; once past ENGAGED_DAY_MIN_SECONDS
    // we record today's date. localStorage-only, cannot error the render.

    startEngagementTracking(): void {
      if (typeof document === 'undefined') return;
      engagementChangeHandler = () => this.updateEngagementActive();
      document.addEventListener('visibilitychange', engagementChangeHandler);
      window.addEventListener('focus', engagementChangeHandler);
      window.addEventListener('blur', engagementChangeHandler);
      // Periodic flush so long, uninterrupted visits still get recorded.
      engagementInterval = setInterval(() => this.flushEngagement(), 5000);
      engagementActiveSince = null;
      this.updateEngagementActive();
    },

    stopEngagementTracking(): void {
      this.flushEngagement();
      if (engagementInterval !== null) {
        clearInterval(engagementInterval);
        engagementInterval = null;
      }
      if (engagementChangeHandler) {
        document.removeEventListener('visibilitychange', engagementChangeHandler);
        window.removeEventListener('focus', engagementChangeHandler);
        window.removeEventListener('blur', engagementChangeHandler);
        engagementChangeHandler = null;
      }
      engagementActiveSince = null;
    },

    isEngagementActive(): boolean {
      return document.visibilityState === 'visible' && document.hasFocus();
    },

    updateEngagementActive(): void {
      const active = this.isEngagementActive();
      if (active && engagementActiveSince === null) {
        engagementActiveSince = Date.now();
      } else if (!active && engagementActiveSince !== null) {
        this.flushEngagement();
        engagementActiveSince = null;
      }
    },

    // Add elapsed active time to today's accrual; record the day past threshold.
    flushEngagement(): void {
      try {
        if (engagementActiveSince === null) return;
        const now = Date.now();
        const elapsed = (now - engagementActiveSince) / 1000;
        engagementActiveSince = now;
        if (elapsed <= 0) return;

        const today = localDateStr(new Date());
        let seconds = 0;
        const raw = localStorage.getItem(ENGAGED_SECONDS_KEY);
        if (raw) {
          const rec = JSON.parse(raw);
          if (rec && rec.date === today && typeof rec.seconds === 'number') {
            seconds = rec.seconds;
          }
        }
        seconds += elapsed;
        localStorage.setItem(ENGAGED_SECONDS_KEY, JSON.stringify({ date: today, seconds }));

        if (seconds >= ENGAGED_DAY_MIN_SECONDS) this.recordEngagedDay(today);
      } catch {
        // Tracking is best-effort; ignore storage/parse failures.
      }
    },

    recordEngagedDay(today: string): void {
      const days = this.readEngagedDaysWithinLookback();
      if (days.includes(today)) return;
      days.push(today);
      // Already pruned to the lookback window by readEngagedDaysWithinLookback.
      localStorage.setItem(ENGAGED_DAYS_KEY, JSON.stringify([...new Set(days)].sort()));
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
