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
      | to either create a new (sub)rule, or to append the word to a pre-existing rule.

  // TODO: Support inspecting a different category than Uncategorized (e.g. to make some category more precise)

  hr

  div(v-if="loading")
    | Loading...
  div(v-else)
    div(v-if="words.length == 0")
      | No events found.
    div(v-else)
      div(v-for="word in words_by_duration")
        div.d-flex.flex-row.hover-bg-gray-100
          div.flex-grow-1
            | {{ word.word }} ({{ Math.round(word.duration) }}s)
          div.flex-grow-0.mb-2
            b-button.mr-1(size="sm" v-on:click="showEvents(word)" variant="outline-dark")
              span(v-if="showing_events[0] != word") Show events
              span(v-else) Hide events
            b-button.mr-1(size="sm" v-on:click="ignoreWord(word.word)") Ignore
            b-button.mr-1(size="sm" v-on:click="createRule(word.word)") Create rule
            b-button(size="sm" v-on:click="appendRule(word.word)") Append rule
        div(v-if="showing_events && showing_events[0] == word")
          table.table.table-sm.table-striped
            tr
              th Title
              th.text-right Duration
            tr(v-for="event in showing_events[1]")
              td {{ event.data.title }}
              td.text-right {{ Math.round(event.duration) }}s
          hr
</template>

<style></style>

<script lang="typescript">
import { canonicalEvents } from '~/queries';
import { getClient } from '~/util/awclient';
import { useCategoryStore } from '~/stores/categories';
import moment from 'moment';

export default {
  name: 'CategoryBuilder',
  components: {},
  props: {},
  data() {
    return {
      loading: true,
      words: {},
      showing_events: [],
    }
  },
  computed: {
    words_by_duration: function() {
      return Object.values(this.words).sort((a, b) => b.duration - a.duration).filter((word) => word.duration > 60);
    },
  },
  watch: {},
  async mounted() {
    await this.fetchWords()
  },
  methods: {
    async fetchWords() {
      this.loading = true
      const categoryStore = useCategoryStore();
      await categoryStore.load();
      const awclient = getClient();
      // TODO: Support different timeperiods
      const now = new Date();
      const today = moment(now).startOf('day').toDate();
      const tomorrow = moment(now).add(1, 'day').startOf('day').toDate();
      const query = canonicalEvents({
        bid_window: "aw-watcher-window_erb-m2.localdomain",
        bid_afk: "aw-watcher-afk_erb-m2.localdomain",
        categories: categoryStore.classes_for_query,
        filter_categories: [['Uncategorized']],
      }) + "RETURN = limit_events(sort_by_duration(events), 1000);";
      const data = await awclient.query([{ start: today, end: tomorrow }], query.split("\n"));
      console.log(data);

      const IGNORE_STRS = ["", "-", "|"];
      const user_ignored_strs = [];  // TODO: load from settings
      const ignore_strs = [...IGNORE_STRS, ...user_ignored_strs];

      const events = data[0];
      const words = {};
      for (const event of events) {
        const words_in_event = event.data.title.split(/[\s\-,:()[\]/]/);
        for (const word of words_in_event) {
          if(word.length <= 2 || ignore_strs.includes(word)) {
            continue;
          }
          if (word in words) {
            words[word].duration += event.duration;
            words[word].events.push(event);
          } else {
            words[word] = {
              word: word,
              duration: event.duration,
              events: [event],
            }
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
        }
        for (const event of events_group) {
          new_event.duration += event.duration;
        }
        events.push(new_event);
      }
      console.log(events);

      this.showing_events = [word, events];
    },
    ignoreWord(word) {
      console.log("Ignoring word: " + word);
      alert("Not implemented yet");
    },
    createRule(word) {
      console.log("Creating rule for word: " + word);
      alert("Not implemented yet");
    },
    appendRule(word) {
      console.log("Appending rule for word: " + word);
      alert("Not implemented yet");
    },
  },
}
</script>
