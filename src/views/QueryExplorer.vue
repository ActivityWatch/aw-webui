<template lang="pug">

div
  h3 Query Explorer

  | See #[a(href="https://docs.activitywatch.net/en/latest/examples/querying-data.html") the documentation] for help on how to write queries.

  hr

  div.alert.alert-danger(v-if="error")
    | {{error}}

  div.alert.alert-danger(v-if="saved_query_error")
    | {{saved_query_error}}

  form
    div.form-row.align-items-end
      div.form-group.col-lg-6
        label.mb-1(for="saved-query-select") Saved Queries
        select#saved-query-select.form-control(v-model="selected_saved_query_id", @change="loadSelectedQuery()")
          option(value="") Select saved query...
          option(v-for="savedQuery in savedQueries", :key="savedQuery.id", :value="savedQuery.id")
            | {{savedQuery.name}}
      div.form-group.col-lg-6
        div.saved-query-actions
          button.btn.btn-success.mr-2(type="button", @click="saveCurrentQuery()") Save Current
          button.btn.btn-secondary.mr-2(type="button", @click="renameSelectedQuery()", :disabled="!selected_saved_query_id") Rename
          button.btn.btn-danger(type="button", @click="deleteSelectedQuery()", :disabled="!selected_saved_query_id")
            icon(name="trash")
            |  Delete

    div.form-row
      div.form-group.col-md-6
        | Start
        input.form-control(type="date", :max="today", v-model="startdate")
      div.form-group.col-md-6
        | End
        input.form-control(type="date", :max="tomorrow", v-model="enddate")

    div.form-group
      textarea.form-control(v-model="query_code", @keypress.ctrl.enter="query()" style="font-family: monospace", rows=10)
    div.form-inline
      div.form-group
        button.btn.btn-success(type="button", @click="query()") Query
      span(style="padding-left: 1em;")
      | {{eventcount_str}}

  hr

  aw-selectable-eventview(:events="events", :event_type="event_type")
</template>

<style scoped lang="scss">
.saved-query-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
}
</style>

<script lang="ts">
import 'vue-awesome/icons/trash';
import moment from 'moment';
import _ from 'lodash';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import {
  buildSavedQuery,
  buildSavedQueryId,
  getDefaultSavedQueryName,
  resolveSavedQueryDates,
  SavedQuery,
  sortSavedQueries,
} from '~/util/savedQueries';

const today = moment().startOf('day');
const tomorrow = moment(today).add(24, 'hours');

export default {
  name: 'QueryExplorer',
  data() {
    const settingsStore = useSettingsStore();

    // allow queries to be saved in a URL parameter
    let queryCode = this.$route.query.q;

    if (_.isEmpty(this.$route.query.q)) {
      queryCode = `
afk_events = query_bucket(find_bucket("aw-watcher-afk_"));
window_events = query_bucket(find_bucket("aw-watcher-window_"));
window_events = filter_period_intersect(window_events, filter_keyvals(afk_events, "status", ["not-afk"]));
merged_events = merge_events_by_keys(window_events, ["app", "title"]);
merged_events = categorize(merged_events, __CATEGORIES__);
RETURN = sort_by_duration(merged_events);
`.trim();
    }

    return {
      settingsStore,
      query_code: queryCode,
      event_type: 'currentwindow',
      events: [],
      today: today.format(),
      tomorrow: tomorrow.format(),
      error: '',
      saved_query_error: '',
      selected_saved_query_id: '',
      startdate: today.format('YYYY-MM-DD'),
      enddate: tomorrow.format('YYYY-MM-DD'),
    };
  },
  computed: {
    savedQueries: function (): SavedQuery[] {
      return sortSavedQueries(this.settingsStore.saved_queries || []);
    },
    selectedSavedQuery: function (): SavedQuery | null {
      return this.savedQueries.find(query => query.id === this.selected_saved_query_id) || null;
    },
    eventcount_str: function () {
      if (Array.isArray(this.events)) return 'Number of events: ' + this.events.length;
      else return '';
    },
  },
  mounted: async function () {
    await this.settingsStore.ensureLoaded();
    useCategoryStore().load();
  },
  methods: {
    persistSavedQueries: async function (savedQueries: SavedQuery[]) {
      try {
        this.saved_query_error = '';
        await this.settingsStore.update({ saved_queries: sortSavedQueries(savedQueries) });
        return true;
      } catch (e) {
        console.error('Failed to save query presets', e);
        this.saved_query_error = 'Failed to save query presets.';
        return false;
      }
    },
    loadSelectedQuery: function () {
      if (!this.selectedSavedQuery) {
        return;
      }

      const { startdate, enddate } = resolveSavedQueryDates(this.selectedSavedQuery);
      this.query_code = this.selectedSavedQuery.query_code;
      this.event_type = this.selectedSavedQuery.event_type || 'currentwindow';
      this.startdate = startdate;
      this.enddate = enddate;
      this.saved_query_error = '';
    },
    saveCurrentQuery: async function () {
      const current = this.selectedSavedQuery;

      if (current) {
        if (!confirm(`Update saved query "${current.name}"?`)) {
          return;
        }

        const updatedQuery = buildSavedQuery({
          id: current.id,
          name: current.name,
          query_code: this.query_code,
          startdate: this.startdate,
          enddate: this.enddate,
          event_type: this.event_type,
        });

        const didPersist = await this.persistSavedQueries(
          this.savedQueries.map(savedQuery =>
            savedQuery.id === current.id ? updatedQuery : savedQuery
          )
        );
        if (didPersist) {
          this.selected_saved_query_id = current.id;
        }
        return;
      }

      const defaultName = getDefaultSavedQueryName(this.query_code);
      const name = prompt('Name for the saved query:', defaultName);
      if (name === null) {
        return;
      }

      const trimmedName = name.trim();
      if (_.isEmpty(trimmedName)) {
        alert('Saved query name cannot be empty.');
        return;
      }

      const newId = buildSavedQueryId(
        trimmedName,
        this.savedQueries.map(savedQuery => savedQuery.id)
      );
      const newQuery = buildSavedQuery({
        id: newId,
        name: trimmedName,
        query_code: this.query_code,
        startdate: this.startdate,
        enddate: this.enddate,
        event_type: this.event_type,
      });

      const didPersist = await this.persistSavedQueries([...this.savedQueries, newQuery]);
      if (didPersist) {
        this.selected_saved_query_id = newId;
      }
    },
    renameSelectedQuery: async function () {
      if (!this.selectedSavedQuery) {
        return;
      }

      const name = prompt('Rename saved query:', this.selectedSavedQuery.name);
      if (name === null) {
        return;
      }

      const trimmedName = name.trim();
      if (_.isEmpty(trimmedName)) {
        alert('Saved query name cannot be empty.');
        return;
      }

      const selectedQueryId = this.selectedSavedQuery.id;
      await this.persistSavedQueries(
        this.savedQueries.map(savedQuery =>
          savedQuery.id === selectedQueryId ? { ...savedQuery, name: trimmedName } : savedQuery
        )
      );
    },
    deleteSelectedQuery: async function () {
      if (!this.selectedSavedQuery) {
        return;
      }

      if (
        !confirm(`Delete saved query "${this.selectedSavedQuery.name}"? This cannot be undone.`)
      ) {
        return;
      }

      const didPersist = await this.persistSavedQueries(
        this.savedQueries.filter(savedQuery => savedQuery.id !== this.selected_saved_query_id)
      );
      if (didPersist) {
        this.selected_saved_query_id = '';
      }
    },
    query: async function () {
      let query = this.query_code;

      // replace magic string `__CATEGORIES__` in query text with latest category rule
      if (_.includes(query, '__CATEGORIES__')) {
        const categoryRules = useCategoryStore().classes_for_query;

        if (useCategoryStore().classes_for_query.length === 0) {
          this.error = '__CATEGORIES__ was used in query but no categories have been defined yet.';
          return;
        }

        query = query.replace('__CATEGORIES__', JSON.stringify(categoryRules));
      }

      // the aw-client expects an array of commands with whitespace cleaned up
      query = query.split(';').map(s => s.trim() + ';');
      const timeperiods = [moment(this.startdate).format() + '/' + moment(this.enddate).format()];

      try {
        const data = await this.$aw.query(timeperiods, query);
        this.events = data[0];
        this.error = '';
      } catch (e) {
        this.error = e.response.data.message;
      }
    },
  },
};
</script>
