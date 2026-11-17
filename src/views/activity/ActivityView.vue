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
  draggable.row(v-if="view" v-model="elements" handle=".handle" :disabled="!editing || saving")
    //- Keep each draft element's identity across reorder/removal. Replacing a
      layout or discarding it rebuilds charts from the restored selections.
    div.p-3(v-for="el in elements", :key="view.id + '-' + layoutRevision + '-' + elementKey(el)", :class="[visClass(el), {'summary-timeline': el.type === 'timeline_barchart'}]")
      aw-selectable-vis(:id="view.elements.indexOf(el)" :type="el.type" :props="el.props" :width="el.width || null" :view-id="view.id" @onTypeChange="onTypeChange" @onWidthChange="onWidthChange" @onRemove="onRemove" :editable="editing && !saving" :disabled="saving")

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
      phoneViewport: false,
      phoneQuery: null as MediaQueryList | null,
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
    mobileDefaultSummary(): boolean {
      // Editing always uses the actual persisted/draft order, at every width.
      return this.phoneViewport && !this.editing && useViewsStore().isDefaultSummary(this.view);
    },
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
        const elements = this.view.elements;
        // Reorder a copy, not saved settings. DOM and visual/keyboard order agree.
        if (this.mobileDefaultSummary) {
          return [
            ...elements.filter(el => el.type === 'timeline_barchart'),
            ...elements.filter(el => el.type !== 'timeline_barchart'),
          ];
        }
        return elements;
      },
      set(elements) {
        useViewsStore().setElements({ view_id: this.view.id, elements });
      },
    },
  },
  mounted() {
    if (!window.matchMedia) return;
    this.phoneQuery = window.matchMedia('(max-width: 575.98px)');
    this.phoneViewport = this.phoneQuery.matches;
    // Old Android WebViews and Safari use the legacy listener API.
    if (this.phoneQuery.addEventListener) {
      this.phoneQuery.addEventListener('change', this.onPhoneQueryChange);
    } else {
      this.phoneQuery.addListener(this.onPhoneQueryChange);
    }
  },
  beforeDestroy() {
    if (!this.phoneQuery) return;
    if (this.phoneQuery.removeEventListener) {
      this.phoneQuery.removeEventListener('change', this.onPhoneQueryChange);
    } else {
      this.phoneQuery.removeListener(this.onPhoneQueryChange);
    }
  },
  methods: {
    onPhoneQueryChange(event: MediaQueryListEvent) {
      this.phoneViewport = event.matches;
    },
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
    onWidthChange(id, width) {
      useViewsStore().setVisualizationWidth({ view_id: this.view.id, el_id: id, width });
    },
    isVisLarge(el) {
      return el.type == 'sunburst_clock' || el.type == 'vis_timeline';
    },
    // Below md every card is full width. `width` is the number of cards per
    // row on large screens; without it, the clock and timeline stay full width.
    // The clock draws at a fixed 750px, so it is always full width.
    visClass(el): string[] {
      const width = el.type == 'sunburst_clock' ? 1 : el.width || (this.isVisLarge(el) ? 1 : 3);
      if (width === 1) return ['col-md-12', 'col-lg-12'];
      if (width === 2) return ['col-md-6', 'col-lg-6'];
      return ['col-md-6', 'col-lg-4'];
    },
  },
};
</script>
