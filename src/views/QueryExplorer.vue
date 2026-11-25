<template lang="pug">

div
  h3 {{ $t('query.title') }}

  | {{ $t('query.docsHelpPrefix') }}#[a(href="https://docs.activitywatch.net/en/latest/examples/querying-data.html") {{ $t('query.docsHelpLink') }}]{{ $t('query.docsHelpSuffix') }}

  hr

  div.alert.alert-danger(v-if="error")
    | {{error}}

  div.alert.alert-danger(v-if="saved_query_error")
    | {{saved_query_error}}

  form
    div.form-row.align-items-end
      div.form-group.col-lg-6
        label.mb-1(for="saved-query-select") {{ $t('ui.query.savedQueries') }}
        select#saved-query-select.form-control(v-model="selected_saved_query_id", @change="loadSelectedQuery()")
          option(value="") {{ $t('ui.query.selectSaved') }}
          option(v-for="savedQuery in savedQueries", :key="savedQuery.id", :value="savedQuery.id")
            | {{savedQuery.name}}
      div.form-group.col-lg-6
        div.saved-query-actions
          button.btn.btn-success.mr-2(type="button", @click="saveCurrentQuery()", :disabled="saved_query_pending") {{ $t('ui.query.saveCurrent') }}
          button.btn.btn-secondary.mr-2(type="button", @click="renameSelectedQuery()", :disabled="!selected_saved_query_id || saved_query_pending") {{ $t('ui.query.rename') }}
          button.btn.btn-danger(type="button", @click="deleteSelectedQuery()", :disabled="!selected_saved_query_id || saved_query_pending")
            icon(name="trash")
            |  {{ $t('common.delete') }}

    div.form-row
      div.form-group.col-md-6
        | {{ $t('query.start') }}
        input.form-control(type="date", :max="today", v-model="startdate")
      div.form-group.col-md-6
        | {{ $t('query.end') }}
        input.form-control(type="date", :max="tomorrow", v-model="enddate")

    div.form-group
      textarea.form-control(v-model="query_code", @keypress.ctrl.enter="query()" style="font-family: monospace", rows=10)
    div.form-inline
      div.form-group
        button.btn.btn-success(type="button", @click="query()") {{ $t('ui.query.run') }}
      span(style="padding-left: 1em;")
      | {{eventcount_str}}

  hr

  aw-selectable-eventview(:events="events", :event_type="event_type")

  b-modal(
    v-model="showSaveQueryModal"
    :title="$t('ui.query.saveTitle')"
    :busy="saved_query_pending"
    :no-close-on-backdrop="saved_query_pending"
    :no-close-on-esc="saved_query_pending"
    :hide-header-close="saved_query_pending"
    :ok-title="$t('common.save')"
    @ok="onSaveQueryConfirm"
    @shown="$refs.saveQueryNameInput && $refs.saveQueryNameInput.focus()"
  )
    div.alert.alert-danger(v-if="saved_query_error" role="alert") {{ saved_query_error }}
    b-form-group(:label="$t('ui.query.savedNameLabel')")
      b-form-input(
        ref="saveQueryNameInput"
        v-model="saveQueryName"
        :placeholder="$t('ui.query.namePlaceholder')"
      )

  b-modal(
    v-model="showRenameQueryModal"
    :title="$t('ui.query.renameTitle')"
    :busy="saved_query_pending"
    :no-close-on-backdrop="saved_query_pending"
    :no-close-on-esc="saved_query_pending"
    :hide-header-close="saved_query_pending"
    :ok-title="$t('ui.query.rename')"
    @ok="onRenameQueryConfirm"
    @shown="$refs.renameQueryNameInput && $refs.renameQueryNameInput.focus()"
  )
    div.alert.alert-danger(v-if="saved_query_error" role="alert") {{ saved_query_error }}
    b-form-group(:label="$t('ui.query.newNameLabel')")
      b-form-input(
        ref="renameQueryNameInput"
        v-model="renameQueryName"
        :placeholder="$t('ui.query.namePlaceholder')"
      )
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
import { querystr_to_array, replaceOutsideStrings } from '~/queries';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { getClient } from '~/util/awclient';
import { isEventArray } from '~/util/queryResult';
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

// Shared across remounted explorers: hold the save lock through any recovery
// read-back. Reject overlap instead of queueing drafts built from optimistic state.
const pendingSavedQueryStores = new WeakSet<object>();

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
      query_request: null,
      saved_query_error: '',
      selected_saved_query_id: '',
      startdate: today.format('YYYY-MM-DD'),
      enddate: tomorrow.format('YYYY-MM-DD'),
      showSaveQueryModal: false,
      saveQueryName: '',
      saveQueryDraft: null as SavedQuery | null,
      showRenameQueryModal: false,
      renameQueryName: '',
      renameQueryTarget: null as SavedQuery | null,
      saved_query_pending: false,
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
      if (isEventArray(this.events)) return 'Number of events: ' + this.events.length;
      else return '';
    },
  },
  mounted: async function () {
    await this.settingsStore.ensureLoaded();
    useCategoryStore().load();
  },
  methods: {
    persistSavedQueries: async function (savedQueries: SavedQuery[]) {
      if (pendingSavedQueryStores.has(this.settingsStore)) {
        this.saved_query_error =
          'Another query preset save is in progress. Please retry after it finishes.';
        return false;
      }
      pendingSavedQueryStores.add(this.settingsStore);
      // No earlier preset write can still own this optimistic settings state.
      const previous = _.cloneDeep(this.settingsStore.saved_queries || []);
      const attempted = sortSavedQueries(savedQueries);
      try {
        this.saved_query_error = '';
        await this.settingsStore.update({ saved_queries: attempted });
        return true;
      } catch (e) {
        console.error('Failed to save query presets', e);
        // The write may have landed before the follow-up reload failed, so ask
        // the server what it holds; the old list is only the offline fallback.
        let confirmed: SavedQuery[] | undefined;
        try {
          const server = (await getClient().get_settings()) as {
            saved_queries?: SavedQuery[];
          };
          if (Array.isArray(server?.saved_queries)) {
            confirmed = server.saved_queries;
          }
        } catch (err) {
          console.error('Failed to read back query presets', err);
        }
        confirmed = confirmed ?? previous;
        // Leave unrelated settings refreshes alone if they replaced the list.
        // Otherwise a failed save leaves a phantom preset (and a retry saves a
        // duplicate), and a failed delete hides a preset that still exists.
        if (_.isEqual(this.settingsStore.saved_queries, attempted)) {
          this.settingsStore.$patch({ saved_queries: confirmed });
        }
        // Compare the request's JSON form: a cleared date's NaN offset is
        // sent, and read back, as null.
        if (_.isEqual(confirmed, JSON.parse(JSON.stringify(attempted)))) return true;
        this.saved_query_error = 'Failed to save query presets.';
        return false;
      } finally {
        pendingSavedQueryStores.delete(this.settingsStore);
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
      if (this.saved_query_pending) return;
      const current = this.selectedSavedQuery;
      // Bind the target and matching draft before confirmation can yield control.
      const draft = buildSavedQuery({
        id: current?.id || '',
        name: current?.name || '',
        query_code: this.query_code,
        startdate: this.startdate,
        enddate: this.enddate,
        event_type: this.event_type,
      });

      if (current) {
        this.saved_query_pending = true;
        try {
          const confirmed = await this.$bvModal.msgBoxConfirm(
            `Update saved query "${draft.name}"?`,
            { title: 'Update Query', okTitle: 'Update', cancelTitle: 'Cancel', centered: true }
          );
          if (!confirmed) return;
          await this.persistSavedQueries(
            this.savedQueries.map(savedQuery => (savedQuery.id === draft.id ? draft : savedQuery))
          );
        } finally {
          this.saved_query_pending = false;
        }
        return;
      }

      // No existing query — open modal to name this snapshot, not a later editor draft.
      this.saved_query_error = '';
      this.saveQueryDraft = draft;
      this.saveQueryName = getDefaultSavedQueryName(draft.query_code);
      this.showSaveQueryModal = true;
    },
    onSaveQueryConfirm: async function (event) {
      event.preventDefault();

      if (this.saved_query_pending) return;
      const draft = this.saveQueryDraft;
      const trimmedName = this.saveQueryName.trim();
      if (_.isEmpty(trimmedName)) {
        this.saved_query_error = 'Saved query name cannot be empty.';
        return;
      }

      if (!draft) return;
      const newId = buildSavedQueryId(
        trimmedName,
        this.savedQueries.map(savedQuery => savedQuery.id)
      );
      const newQuery = { ...draft, id: newId, name: trimmedName };
      this.saved_query_pending = true;
      try {
        const didPersist = await this.persistSavedQueries([...this.savedQueries, newQuery]);
        if (didPersist && this.saveQueryDraft === draft) {
          if (!this.selected_saved_query_id) this.selected_saved_query_id = newId;
          this.showSaveQueryModal = false;
        }
      } finally {
        this.saved_query_pending = false;
      }
    },
    renameSelectedQuery: async function () {
      if (this.saved_query_pending || !this.selectedSavedQuery) {
        return;
      }

      this.saved_query_error = '';
      this.renameQueryTarget = { ...this.selectedSavedQuery };
      this.renameQueryName = this.renameQueryTarget.name;
      this.showRenameQueryModal = true;
    },
    onRenameQueryConfirm: async function (event) {
      event.preventDefault();

      if (this.saved_query_pending) return;
      const target = this.renameQueryTarget;
      const trimmedName = this.renameQueryName.trim();
      if (_.isEmpty(trimmedName)) {
        this.saved_query_error = 'Saved query name cannot be empty.';
        return;
      }

      if (!target) return;
      this.saved_query_pending = true;
      try {
        const didPersist = await this.persistSavedQueries(
          this.savedQueries.map(savedQuery =>
            savedQuery.id === target.id ? { ...savedQuery, name: trimmedName } : savedQuery
          )
        );
        if (didPersist && this.renameQueryTarget === target) {
          this.showRenameQueryModal = false;
        }
      } finally {
        this.saved_query_pending = false;
      }
    },
    deleteSelectedQuery: async function () {
      if (this.saved_query_pending || !this.selectedSavedQuery) return;
      const targetId = this.selectedSavedQuery.id;
      const targetName = this.selectedSavedQuery.name;
      this.saved_query_pending = true;
      try {
        const confirmed = await this.$bvModal.msgBoxConfirm(
          `Delete saved query "${targetName}"? This cannot be undone.`,
          {
            title: 'Delete Query',
            okTitle: 'Delete',
            okVariant: 'danger',
            cancelTitle: 'Cancel',
            centered: true,
          }
        );
        if (!confirmed) return;
        const didPersist = await this.persistSavedQueries(
          this.savedQueries.filter(savedQuery => savedQuery.id !== targetId)
        );
        if (didPersist && this.selected_saved_query_id === targetId) {
          this.selected_saved_query_id = '';
        }
      } finally {
        this.saved_query_pending = false;
      }
    },
    query: async function () {
      // Even a submission that fails local validation supersedes pending requests.
      const request = {};
      this.query_request = request;
      let query = this.query_code;

      // Replace the magic string `__CATEGORIES__` in query text with the latest
      // category rule. Only occurrences outside quoted literals are placeholders:
      // a query may legitimately search for the marker's own text.
      const withCategories = replaceOutsideStrings(
        query,
        '__CATEGORIES__',
        JSON.stringify(useCategoryStore().classes_for_query)
      );
      if (withCategories !== query) {
        if (useCategoryStore().classes_for_query.length === 0) {
          this.error = '__CATEGORIES__ was used in query but no categories have been defined yet.';
          return;
        }
        query = withCategories;
      }

      // the aw-client expects an array of commands with whitespace cleaned up
      query = querystr_to_array(query as string);
      const timeperiods = [moment(this.startdate).format() + '/' + moment(this.enddate).format()];

      try {
        const data = await this.$aw.query(timeperiods, query);
        if (this.query_request !== request) return;
        this.events = data[0];
        this.error = '';
      } catch (e) {
        if (this.query_request !== request) return;
        this.error =
          e?.response?.data?.message ||
          e?.message ||
          (typeof e === 'string' ? e : '') ||
          this.$t('ui.query.requestError');
      }
    },
  },
};
</script>
