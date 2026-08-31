<template lang="pug">
div
  // Standalone mode prints the full intro; embedded mode (used inside
  // CategorizationSettings) omits the header so it doesn't double up
  // with the section title that wraps the embed.
  div(v-if="!embedded")
    h3 Categorization helper
    p
      | This tool helps you create categories from your uncategorized time.
      | It scans a recent window for the most common app/title words (by
      | time, not count) so you can promote each one into a new category,
      | append it to an existing rule, or ignore it. Words under 60s are
      | hidden.

  div.d-flex
    div.flex-grow-1
      div
        b Options
      div
        small Hostname: {{ queryOptions.hostname || '(not selected)' }}
      div
        small Range: {{ queryOptions.start }} - {{ queryOptions.stop }}
    div.flex-grow-0
      b-button(variant="outline-dark" @click="show_options = !show_options" size="sm")
        span(v-if="!show_options") Show options
        span(v-else) Hide options

  div(v-if="show_options")
    hr
    h4 Options
    aw-query-options(v-model="queryOptions")

  hr

  h5 Common words in "{{category.join(" > ")}}" events
  div(v-if="loading")
    b-spinner.mr-2(small)
    span.text-muted Loading...
  div(v-else-if="hostnameEmptyKind === 'no-hosts'")
    p.text-muted.mb-0
      | No host with window/AFK buckets is available. Install
      | #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") a watcher]
      | to start collecting data.
  div(v-else-if="hostnameEmptyKind === 'hostname-unselected'")
    p.text-muted.mb-0
      | Select a hostname under
      | #[b Show options]
      | to load uncategorized words. The hostname picker is hidden until you open options.
  div(v-else)
    div(v-if="words_by_duration.length == 0")
      | No words with significant duration. You're good to go!
    div(v-else)
      div.row.category-builder-word(v-for="word in words_visible" :key="word.word")
        div.col.hover-highlight
          div.d-flex.flex-row.py-2
            div.flex-grow-1
              | {{ word.word }} ({{ Math.round(word.duration) }}s)
            div.flex-grow-0
              b-button.mr-1(size="sm" @click="createRule(word.word)" variant="success")
                | New rule
              b-button.mr-1(size="sm" @click="appendRule(word.word)" variant="warning")
                | Append rule
              b-button.mr-1(size="sm" @click="ignoreWord(word.word)")
                | Ignore
              b-button(size="sm" @click="showEvents(word)" variant="outline-dark")
                span(v-if="showing_events[0] != word") Show events
                span(v-else) Hide events
          div(v-if="showing_events && showing_events[0] == word")
            table.table.table-sm.table-striped
              tr
                th Title
                th.text-right Duration
              tr(v-for="event in showing_events[1]")
                td {{ event.data.title || event.data.app }}
                td.text-right {{ Math.round(event.duration) }}s
            hr
      div.d-flex.align-items-center.mt-3(v-if="hasMoreWords")
        small.text-muted
          | Showing {{ words_visible.length }} of {{ words_by_duration.length }} words
        b-button.ml-auto(
          size="sm"
          variant="outline-primary"
          @click="visible_count += page_size"
        ) Show more

  div(v-if="create.categoryId !== null")
    CategoryEditModal(:categoryId="create.categoryId",
                      @ok="createRuleOk()"
                      @hidden="createRuleCancel()")

  b-modal(id="appendRule" title="Append rule" @ok="handleOk" :ok-disabled="!valid")
    b-form(ref="form" @submit.stop.prevent="handleSubmit")
      b-form-group(label="Rule"
                   label-for="append-category"
                   invalid-feedback="Category is required"
                   :state="validCategory"
                   required)
        b-form-select#append-category(v-model="append.category")
          b-form-select-option(v-for="cat in allCategoriesSelect" :value="cat.value" :key="cat.id") {{ cat.text }}
      b-form-group(label="Word")
        b-form-input(v-model="append.word")
        small
          div.text-success(v-if="validPattern") Valid
          div.text-danger(v-else) Invalid pattern
          div(v-if="validPattern && broad_pattern" style="color: orange") Pattern too broad
</template>

<style>
.hover-highlight:hover {
  background-color: #eee;
}
</style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { mapState } from 'pinia';

import { useCategoryStore } from '~/stores/categories';
import { useBucketsStore } from '~/stores/buckets';

import { canonicalEvents } from '~/queries';
import { getClient } from '~/util/awclient';
import CategoryEditModal from '~/components/CategoryEditModal.vue';
import { isRegexBroad, validateRegex } from '~/util/validate';
import { findCommonPhrases } from '~/util/categorization';
import { categoryBuilderHostnameEmptyKind, selectSoleKnownHostname } from '~/util/hostnames';

export default {
  name: 'CategoryBuilder',
  components: { CategoryEditModal },
  props: {
    // When embedded inside CategorizationSettings, drop the standalone
    // page chrome so the embed reads as a subsection of the parent.
    embedded: { type: Boolean, default: false },
  },
  data() {
    return {
      loading: true,

      categoryStore: useCategoryStore(),

      // Pagination for the words list. Showing the full list directly
      // produced a 2+ screen wall of buttons on most users' data; this
      // shows page_size at a time with a "Show more" button.
      page_size: 10,
      visible_count: 10,

      // Options
      show_options: false,
      queryOptions: {
        hostname: '',
        start: moment().subtract(1, 'day').format('YYYY-MM-DD'),
        stop: moment().add(1, 'day').format('YYYY-MM-DD'),
      },

      // TODO: Support inspecting a different category than Uncategorized (e.g. to make some category more precise)
      category: ['Uncategorized'],

      words: {},
      showing_events: [],

      // TODO: load from settings
      ignored_words: [],

      append: {
        word: '',
        category: [],
      },
      create: {
        word: '',
        categoryId: null,
      },
    };
  },
  computed: {
    ...mapState(useCategoryStore, ['allCategoriesSelect']),
    words_by_duration: function () {
      const words: { word: string; duration: number }[] = [...this.words.values()];
      return words
        .sort((a, b) => b.duration - a.duration)
        .filter(word => word.duration > 60)
        .filter(word => !this.ignored_words.includes(word.word));
    },
    words_visible: function () {
      return this.words_by_duration.slice(0, this.visible_count);
    },
    hasMoreWords: function () {
      return this.words_by_duration.length > this.visible_count;
    },
    valid: function () {
      return this.validPattern && this.validCategory;
    },
    validPattern: function () {
      return validateRegex(this.append.word);
    },
    validCategory: function () {
      return this.append.category.length > 0;
    },
    broad_pattern: function () {
      return isRegexBroad(this.append.word);
    },
    hostnameEmptyKind: function () {
      return categoryBuilderHostnameEmptyKind(useBucketsStore().hosts, this.queryOptions.hostname);
    },
  },
  watch: {
    queryOptions: {
      handler: function () {
        this.fetchWords();
      },
      deep: true,
    },
  },
  async mounted() {
    // Make sure we don't have stale unsaved changes in categoryStore
    const bucketsStore = useBucketsStore();
    await bucketsStore.ensureLoaded();
    await this.categoryStore.load();
    const sole = selectSoleKnownHostname(bucketsStore.hosts);
    if (sole && !this.queryOptions.hostname) {
      this.$set(this.queryOptions, 'hostname', sole);
      // Deep watch on queryOptions calls fetchWords.
    } else {
      await this.fetchWords();
    }
  },
  methods: {
    async fetchWords() {
      this.loading = true;
      // Reset pagination so the user sees the top of the new ranking
      // after every requery.
      this.visible_count = this.page_size;
      if (!this.queryOptions.hostname) {
        // Auto-select only when there is exactly one real hostname. Several
        // known hosts (or only "unknown") stay unset so the empty-state copy
        // can point at Show options / the hostname picker instead of
        // silently querying the first device.
        const sole = selectSoleKnownHostname(useBucketsStore().hosts);
        if (sole) {
          this.$set(this.queryOptions, 'hostname', sole);
          // Deep watch re-enters fetchWords with hostname set.
          return;
        }
        this.loading = false;
        return;
      }
      await this.categoryStore.load();
      const awclient = getClient();

      // Hosts without a window/AFK bucket pair (Android, iOS/ScreenTime import)
      // need to be queried through their android-style bucket instead, mirroring
      // query_android in the activity store (which also prefers the ScreenTime
      // bucket when both exist for a host).
      const bucketsStore = useBucketsStore();
      const hostname = this.queryOptions.hostname;
      const windowAvail =
        bucketsStore.bucketsWindow(hostname).length > 0 &&
        bucketsStore.bucketsAFK(hostname).length > 0;
      const androidBuckets = bucketsStore.bucketsAndroid(hostname);
      let bucketParams;
      if (!windowAvail && androidBuckets.length > 0) {
        const screentimeBucket = androidBuckets.find(id => id.startsWith('aw-import-screentime'));
        bucketParams = { bid_android: screentimeBucket || androidBuckets[0] };
      } else {
        bucketParams = {
          bid_window: 'aw-watcher-window_' + hostname,
          bid_afk: 'aw-watcher-afk_' + hostname,
          filter_afk: this.queryOptions.filter_afk,
        };
      }

      const query =
        canonicalEvents({
          ...bucketParams,
          categories: this.categoryStore.classes_for_query,
          filter_categories: [this.category],
        }) + 'RETURN = limit_events(sort_by_duration(events), 1000);';
      const data = await awclient.query(
        [
          {
            start: new Date(this.queryOptions.start),
            end: new Date(this.queryOptions.stop),
          },
        ],
        query.split('\n')
      );

      const events = data[0];
      this.words = findCommonPhrases(events, this.ignored_words);
      this.loading = false;
    },
    showEvents(word) {
      // If already showing events, hide them and return
      if (this.showing_events[0] == word) {
        this.showing_events = [];
        return;
      }
      // TODO: Group events by data
      const grouped_events = {};
      for (const event of word.events) {
        const key = JSON.stringify(event.data);
        if (key in grouped_events) {
          grouped_events[key].push(event);
        } else {
          grouped_events[key] = [event];
        }
      }

      // Construct a new array of events with the grouped events
      const events = [];
      for (const key in grouped_events) {
        const events_group = grouped_events[key];
        const new_event = {
          ...events_group[0],
          duration: 0,
        };
        for (const event of events_group) {
          new_event.duration += event.duration;
        }
        events.push(new_event);
      }

      this.showing_events = [word, events];
    },
    ignoreWord(word: string) {
      console.log('Ignoring word: ' + word);
      this.ignored_words.push(word);
    },
    createRule(word: string) {
      console.log('Opening modal for creating rule with word: ' + word);
      const lastId = this.categoryStore.addClass({
        name: [word],
        rule: { type: 'regex', regex: _.escapeRegExp(word) },
      });
      this.create.word = word;
      this.create.categoryId = lastId;
    },
    async createRuleOk() {
      console.log('Creating rule with word: ' + this.create.word);
      await this.categoryStore.save();
      this.fetchWords();
    },
    async createRuleCancel() {
      console.log('Cancelling create rule');
      this.create.categoryId = null;
      this.categoryStore.load(); // Restore categories to last saved
    },
    appendRule(word) {
      console.log('Opening modal to append rule with word: ' + word);
      this.append.word = _.escapeRegExp(word);
      this.$bvModal.show('appendRule');
    },
    async appendRuleOk() {
      console.log('Appending rule with word: ' + this.append.word);
      const cat = this.categoryStore.get_category(this.append.category);
      this.categoryStore.appendClassRule(cat.id, this.append.word);
      await this.categoryStore.save();
      this.fetchWords();
    },
    handleOk(bvModalEvent) {
      // Prevent modal from closing (to be closed later in handleSubmit, if validation passes)
      bvModalEvent.preventDefault();

      // Trigger submit handler
      this.handleSubmit(bvModalEvent);
    },
    handleSubmit(e) {
      // Exit when the form isn't valid
      if (!this.valid) {
        //console.log(e);
        e.preventDefault();
        return;
      }

      // Hide the modal manually
      this.$nextTick(() => {
        this.$bvModal.hide('appendRule');
      });

      this.appendRuleOk();
    },
  },
};
</script>
