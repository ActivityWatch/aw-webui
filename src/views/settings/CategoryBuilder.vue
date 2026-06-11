<template lang="pug">
div
  // Standalone mode prints the full intro; embedded mode (used inside
  // CategorizationSettings) omits the header so it doesn't double up
  // with the section title that wraps the embed.
  div(v-if="!embedded")
    h3 {{ $t('categories.helperTitle') }}
    p
      | {{ $t('categories.helperDescription') }}

  div.d-flex
    div.flex-grow-1
      div
        b {{ $t('categories.options') }}
      div
        small {{ $t('categories.hostname') }} {{ queryOptions.hostname }}
      div
        small {{ $t('categories.range') }} {{ queryOptions.start }} - {{ queryOptions.stop }}
    div.flex-grow-0
      b-button(variant="outline-dark" @click="show_options = !show_options" size="sm")
        span(v-if="!show_options") {{ $t('categories.showOptions') }}
        span(v-else) {{ $t('categories.hideOptions') }}

  div(v-show="show_options")
    hr
    h4 {{ $t('categories.options') }}
    aw-query-options(v-model="queryOptions")

  hr

  h5 {{ $t('categories.commonWordsIn', { category: category.join(" > ") }) }}
  div(v-if="loading")
    b-spinner.mr-2(small)
    span.text-muted {{ $t('common.loading') }}
  div(v-else-if="!queryOptions.hostname")
    p.text-muted.mb-0
      | {{ $t('categories.noHostBefore') }}
      | #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") {{ $t('categories.watcher') }}]
      | {{ $t('categories.noHostAfter') }}
  div(v-else)
    div(v-if="words_by_duration.length == 0")
      | {{ $t('categories.noSignificantWords') }}
    div(v-else)
      div.row.category-builder-word(v-for="word in words_visible" :key="word.word")
        div.col.hover-highlight
          div.d-flex.flex-row.py-2
            div.flex-grow-1
              | {{ word.word }} ({{ Math.round(word.duration) }}{{ $t('categories.secondsShort') }})
            div.flex-grow-0
              b-button.mr-1(size="sm" @click="createRule(word.word)" variant="success")
                | {{ $t('categories.newRule') }}
              b-button.mr-1(size="sm" @click="appendRule(word.word)" variant="warning")
                | {{ $t('categories.appendRule') }}
              b-button.mr-1(size="sm" @click="ignoreWord(word.word)")
                | {{ $t('categories.ignore') }}
              b-button(size="sm" @click="showEvents(word)" variant="outline-dark")
                span(v-if="showing_events[0] != word") {{ $t('categories.showEvents') }}
                span(v-else) {{ $t('categories.hideEvents') }}
          div(v-if="showing_events && showing_events[0] == word")
            table.table.table-sm.table-striped
              tr
                th {{ $t('categories.title') }}
                th.text-right {{ $t('categories.duration') }}
              tr(v-for="event in showing_events[1]")
                td {{ event.data.title }}
                td.text-right {{ Math.round(event.duration) }}{{ $t('categories.secondsShort') }}
            hr
      div.d-flex.align-items-center.mt-3(v-if="hasMoreWords")
        small.text-muted
          | {{ $t('categories.showingWords', { shown: words_visible.length, total: words_by_duration.length }) }}
        b-button.ml-auto(
          size="sm"
          variant="outline-primary"
          @click="visible_count += page_size"
        ) {{ $t('categories.showMore') }}

  div(v-if="create.categoryId !== null")
    CategoryEditModal(:categoryId="create.categoryId",
                      @ok="createRuleOk()"
                      @hidden="createRuleCancel()")

  b-modal(id="appendRule" :title="$t('categories.appendRule')" @ok="handleOk" :ok-disabled="!valid")
    b-form(ref="form" @submit.stop.prevent="handleSubmit")
      b-form-group(:label="$t('categories.rule')"
                   label-for="append-category"
                   :invalid-feedback="$t('categories.categoryRequired')"
                   :state="validCategory"
                   required)
        b-form-select#append-category(v-model="append.category")
          b-form-select-option(v-for="cat in allCategoriesSelect" :value="cat.value" :key="cat.id") {{ cat.text }}
      b-form-group(:label="$t('categories.word')")
        b-form-input(v-model="append.word")
        small
          div.text-success(v-if="validPattern") {{ $t('categories.valid') }}
          div.text-danger(v-else) {{ $t('categories.invalidPattern') }}
          div(v-if="validPattern && broad_pattern" style="color: orange") {{ $t('categories.patternTooBroad') }}
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
        start: moment().subtract(1, 'day'),
        stop: moment().add(1, 'day'),
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
    await useBucketsStore().ensureLoaded();
    await this.categoryStore.load();
    // Called by watch
    //await this.fetchWords();
  },
  methods: {
    async fetchWords() {
      this.loading = true;
      // Reset pagination so the user sees the top of the new ranking
      // after every requery.
      this.visible_count = this.page_size;
      if (!this.queryOptions.hostname) {
        // Try to resolve hostname from loaded buckets
        // Don't ever return the "unknown" hostname
        const hosts = useBucketsStore().hosts;
        if (hosts && hosts.length > 0) {
          this.queryOptions.hostname = _.filter(hosts, host => host !== 'unknown')[0];
        }
        // If still no valid hostname, bail out and wait for QueryOptions to provide one
        if (!this.queryOptions.hostname) {
          this.loading = false;
          return;
        }
      }
      await this.categoryStore.load();
      const awclient = getClient();
      const query =
        canonicalEvents({
          bid_window: 'aw-watcher-window_' + this.queryOptions.hostname,
          bid_afk: 'aw-watcher-afk_' + this.queryOptions.hostname,
          filter_afk: this.queryOptions.filter_afk,
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
      this.categoryStore.addClass({
        name: [word],
        rule: { type: 'regex', regex: _.escapeRegExp(word) },
      });

      // Find the category with the max ID, and open an editor for it
      const lastId = _.max(_.map(this.categoryStore.classes, 'id'));
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
