<template lang="pug">
div(v-if="viewMissing")
  b-alert.mt-3(show variant="warning")
    | {{ $t('ui.activity.missingView', { view: view_id }) }}
    |
    router-link(:to="{ name: 'activity-view', params: {...$route.params, view_id: 'default'} }")
      | {{ $t('ui.activity.goDefault') }}
    | .
div(v-else-if="view || editing")
  b-alert.mt-3(:show="saveError !== ''" variant="danger")
    | {{ saveError }}
  //- Keep Save/Cancel available when removing the final view empties the draft.
  draggable.row(v-if="view" v-model="elements" handle=".handle" :disabled="saving")
    // TODO: Handle large/variable sized visualizations better
    //- Keep each draft element's identity across reorder/removal. Replacing a
      layout or discarding it rebuilds charts from the restored selections.
    div.col-md-6.col-lg-4.p-3(v-for="el, index in elements", :key="view.id + '-' + layoutRevision + '-' + elementKey(el)", :class="{'col-md-12': isVisLarge(el), 'col-lg-12': isVisLarge(el)}")
      aw-selectable-vis(:id="index" :type="el.type" :props="el.props" :view-id="view.id" @onTypeChange="onTypeChange" @onRemove="onRemove" :editable="editing && !saving" :disabled="saving")

    div.col-md-6.col-lg-4.p-3(v-if="editing")
      b-button(@click="addVisualization" :disabled="saving" variant="outline-dark" block size="lg")
        icon(name="plus")
        span {{ $t('activityView.addVisualization') }}

  div(v-if="editing").mt-2
    div.d-flex.flex-row-reverse
      b-button(variant="outline-dark" :disabled="saving" @click="discard")
        icon(name="times")
        span {{ $t('activityView.cancel') }}
      b-button.mr-2(variant="success" :disabled="saving" @click="save")
        icon(name="save")
        span {{ $t('activityView.save') }}
    div.mt-2.d-flex.flex-row-reverse
      b-button(variant="warning" size="sm" :disabled="saving" @click="restoreDefaults();")
        icon(name="undo")
        span {{ $t('activityView.restoreDefaults') }}
      b-button.mr-2(v-if="view" variant="danger" size="sm" :disabled="saving" v-b-modal="'remove-view-modal-' + view.id")
        icon(name="trash")
        span {{ $t('activityView.remove') }}
  div(v-else).d-flex.flex-row-reverse.mt-2
    b-button(variant="outline-dark" size="sm" @click="editing = !editing")
      icon(name="edit")
      span {{ $t('activityView.editView') }}

  b-modal(
    v-if="view"
    :id="'remove-view-modal-' + view.id"
    :title="$t('activityView.removeViewTitle')"
    centered
    :ok-title="$t('activityView.removeViewOk')"
    ok-variant="danger"
    cancel-variant="outline-secondary"
    @ok="remove"
  )
    | {{ $t('activityView.removeViewConfirm') }} "{{ view.name || view.id }}"?
    br
    br
    | {{ $t('activityView.removeViewHint') }} #[b {{ $t('activityView.restoreDefaults') }}] {{ $t('activityView.removeViewRestoreHint') }}

  b-modal(
    v-model="showCustomVisModal"
    :title="$t('ui.activity.addCustomVisualization')"
    :ok-title="$t('ui.activity.add')"
    @ok="onCustomVisConfirm"
  )
    b-form-group(:label="$t('ui.activity.watcherName')")
      b-form-input(
        v-model="customVisWatcherName"
        placeholder="aw-watcher-"
      )
    b-form-group(:label="$t('ui.activity.visualizationTitle')")
      b-form-input(
        v-model="customVisTitle"
        :placeholder="$t('ui.activity.myVisualization')"
      )
</template>

<script lang="ts">
import 'vue-awesome/icons/save';
import 'vue-awesome/icons/times';
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/undo';

import draggable from 'vuedraggable';

import { useViewsStore } from '~/stores/views';

const elementKeys = new WeakMap<object, number>();
let nextElementKey = 0;

export default {
  name: 'ActivityView',
  components: {
    draggable: draggable,
  },
  props: {
    view_id: { type: String, default: 'default' },
  },
  data() {
    return {
      editing: false,
      pendingAction: false,
      saveError: '',
      layoutRevision: 0,
      showCustomVisModal: false,
      customVisWatcherName: 'aw-watcher-',
      customVisTitle: '',
      pendingCustomVisId: null as number | null,
    };
  },
  computed: {
    saving(): boolean {
      return this.pendingAction || useViewsStore().saving;
    },
    views: function () {
      return useViewsStore().viewsForHost(this.$route.params.host || '');
    },
    view: function () {
      if (this.view_id == 'default') {
        return this.views[0];
      } else {
        return this.views.find(v => v.id == this.view_id);
      }
    },
    viewMissing: function (): boolean {
      // True only once views have loaded but the requested id doesn't exist.
      // Without this guard, navigating to a stale URL (e.g. /view/category)
      // silently rendered the default view's content under the wrong tab.
      return this.views.length > 0 && this.view_id !== 'default' && !this.view;
    },
    elements: {
      get() {
        return this.view.elements;
      },
      set(elements) {
        useViewsStore().setElements({ view_id: this.view.id, elements });
      },
    },
  },
  methods: {
    elementKey(element): number {
      if (!elementKeys.has(element)) elementKeys.set(element, nextElementKey++);
      return elementKeys.get(element);
    },
    async save() {
      if (this.saving) return;
      this.pendingAction = true;
      this.saveError = '';
      try {
        await useViewsStore().save();
        this.editing = false;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : String(error);
      } finally {
        this.pendingAction = false;
      }
    },
    async discard() {
      if (this.saving) return;
      this.pendingAction = true;
      this.saveError = '';
      try {
        await useViewsStore().load();
        this.layoutRevision++;
        this.editing = false;
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : String(error);
      } finally {
        this.pendingAction = false;
      }
    },
    remove() {
      useViewsStore().removeView({ view_id: this.view.id });
      // If we're on an URL that'll be invalid after removing the view, navigate to the main/default view
      if (!this.$route.path.includes('default')) {
        this.$router.replace('./default');
      }
    },
    restoreDefaults() {
      useViewsStore().restoreDefaults();
      this.layoutRevision++;
      alert(this.$t('activityView.restoreAlert'));
      // If we're on an URL that might become invalid, navigate to the main/default view
      if (!this.$route.path.includes('default')) {
        this.$router.replace('./default');
      }
    },
    addVisualization: function () {
      useViewsStore().addVisualization({ view_id: this.view.id, type: 'top_apps' });
    },
    async onTypeChange(id, type) {
      if (type === 'custom_vis') {
        // Show modal to collect watcher name and visualization title
        this.pendingCustomVisId = id;
        this.customVisWatcherName = 'aw-watcher-';
        this.customVisTitle = '';
        this.showCustomVisModal = true;
        return;
      }

      await useViewsStore().editView({ view_id: this.view.id, el_id: id, type, props: {} });
    },
    async onCustomVisConfirm(event) {
      if (!this.customVisWatcherName.trim() || !this.customVisTitle.trim()) {
        event.preventDefault();
        return;
      }
      const props = {
        visname: this.customVisWatcherName,
        title: this.customVisTitle,
      };
      await useViewsStore().editView({
        view_id: this.view.id,
        el_id: this.pendingCustomVisId,
        type: 'custom_vis',
        props,
      });
    },
    async onRemove(id) {
      await useViewsStore().removeVisualization({ view_id: this.view.id, el_id: id });
    },
    isVisLarge(el) {
      return el.type == 'sunburst_clock' || el.type == 'vis_timeline';
    },
  },
};
</script>
