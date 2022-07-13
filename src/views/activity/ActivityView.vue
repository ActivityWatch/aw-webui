<template lang="pug">
div(v-if="view")
  draggable.row(v-model="elements" handle=".handle")
    // TODO: Handle large/variable sized visualizations better
    div.col-md-6.col-lg-4.p-3(v-for="el, index in elements", :key="index", :class="{'col-md-12': isVisLarge(el), 'col-lg-8': isVisLarge(el)}")
      aw-selectable-vis(:id="index" :type="el.type" :props="el.props" @onTypeChange="onTypeChange" @onRemove="onRemove" :editable="editing")

    div.col-md-6.col-lg-4.p-3(v-if="editing")
      b-button(@click="addVisualization" variant="outline-dark" block size="lg")
        icon(name="plus")
        span Add visualization

  div(v-if="editing").mt-2
    div.d-flex.flex-row-reverse
      b-button(variant="outline-dark" @click="discard(); editing = !editing;")
        icon(name="times")
        span Cancel
      b-button.mr-2(variant="success" @click="save(); editing = !editing;")
        icon(name="save")
        span Save
    div.mt-2.d-flex.flex-row-reverse
      b-button(variant="warning" size="sm" @click="restoreDefaults();")
        icon(name="undo")
        span Restore defaults
      b-button.mr-2(variant="danger" size="sm" @click="remove();")
        icon(name="trash")
        span Remove
  div(v-else).d-flex.flex-row-reverse.mt-2
    b-button(variant="outline-dark" size="sm" @click="editing = !editing")
      icon(name="edit")
      span Edit view
</template>

<script>
import 'vue-awesome/icons/save';
import 'vue-awesome/icons/times';
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/undo';

import { mapState } from 'pinia';
import draggable from 'vuedraggable';

import { useViewsStore } from '@/stores/views';

export default {
  name: 'ActivityView',
  components: {
    draggable: draggable,
  },
  props: {
    view_id: { type: String, default: 'default' },
  },
  data() {
    return { editing: false };
  },
  computed: {
    ...mapState(useViewsStore, ['views']),
    view: function () {
      if (this.view_id == 'default') {
        return this.views[0];
      } else {
        return this.views.find(v => v.id == this.view_id);
      }
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
    save() {
      useViewsStore().save();
    },
    discard() {
      useViewsStore().load();
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
      alert(
        "All views have been restored to defaults. Changes won't be saved until you click 'Save'."
      );
      // If we're on an URL that might become invalid, navigate to the main/default view
      if (!this.$route.path.includes('default')) {
        this.$router.replace('./default');
      }
    },
    addVisualization: function () {
      useViewsStore().addVisualization({ view_id: this.view.id, type: 'top_apps' });
    },
    async onTypeChange(id, type) {
      let props = {};

      if (type === 'custom_vis') {
        const visname = prompt('Please enter the watcher name', 'aw-watcher-');
        if (!visname) return;

        const title = prompt('Please enter the visualization title');
        if (!title) return;

        props = {
          visname,
          title,
        };
      }

      await useViewsStore().editView({ view_id: this.view.id, el_id: id, type, props });
    },
    async onRemove(id) {
      await useViewsStore().removeVisualization({ view_id: this.view.id, el_id: id });
    },
    isVisLarge(el) {
      return el.type == 'sunburst_clock';
    },
  },
};
</script>
