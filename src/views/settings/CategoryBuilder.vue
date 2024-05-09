<template lang="pug">
div
  h1 Categorization helper
  div
    p
      | This tool will help you create categories from your uncategorized time.

    p
      | It works by fetching all uncategorized time for a recent timeperiod,
      | and then finds the most common words (by time, not count) each of
      | which may then either be ignored (if too broad/irrelevant), or used
      | to create a new (sub)category, or to append the word to a pre-existing category rule.
      | Words with less than 60s of time will not be shown.

    p
      | When you're done, you can inspect the categories in the #[router-link(:to="{ path: '/settings' }") Settings] page.


  div.d-flex
    div.flex-grow-1
      div
        b Options
      div
        small Hostname: {{ queryOptions.hostname }}
      div
        small Range: {{ queryOptions.start }} - {{ queryOptions.stop }}
    div.flex-grow-0
      b-button(variant="outline-dark" @click="show_options = !show_options" size="sm")
        span(v-if="!show_options") Show options
        span(v-else) Hide options

  div(v-show="show_options")
    hr
    h4 Options
    aw-query-options(v-model="queryOptions")

  hr

  h5 Common words in "{{category.join(" > ")}}" events
  div(v-if="loading")
    | Loading...
  div(v-else)
    div(v-if="words_by_duration.length == 0")
      | No words with significant duration. You're good to go!
    div(v-else)
      div.row.category-builder-word(v-for="word in words_by_duration")
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
                td {{ event.data.title }}
                td.text-right {{ Math.round(event.duration) }}s
            hr
      //hr
      //div.d-flex
        div.flex-grow-1
        div.flex-grow-0
          b-button(size="sm" @click="days_back += 7; fetchWords()") Load more

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
          div(v-if="validPattern" style="color: green") Valid
          div(v-else style="color: red") Invalid pattern
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

export default {
  name: 'aw-category-builder',
  components: { CategoryEditModal },
  props: {},
  data() {
    return {
      loading: true,

      categoryStore: useCategoryStore(),

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
      if (!this.queryOptions.hostname) {
        // FIXME: This is a hack to ensure that the hostname is set (otherwise isn't due to some race condition)
        // Don't ever return the "unknown" hostname
        // TODO: ideally, only choose a hostname that has the right buckets
        this.queryOptions.hostname = _.filter(
          useBucketsStore().hosts,
          host => host !== 'unknown'
        )[0];
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
      const words = new Map<string, { word: string; duration: number; events: any[] }>();
      for (const event of events) {
        const words_in_event = event.data.title.split(/[\s\-,:()[\]/]/);
        for (const word of words_in_event) {
          if (word.length <= 2 || this.ignored_words.includes(word)) {
            continue;
          }
          if (words.has(word)) {
            words.get(word).duration += event.duration;
            words.get(word).events.push(event);
          } else {
            words.set(word, {
              word: word,
              duration: event.duration,
              events: [event],
            });
          }
        }
      }
      this.words = words;
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
