<template lang="pug">
div(v-if="view")
  div.row
    div.col-md-6.col-lg-4.p-3(v-for="el, index in view.elements")
      aw-selectable-vis(:id="index" :type="el.type" @onTypeChange="onTypeChange" @onRemove="onRemove" :editable="editing")

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

export default {
  name: 'ActivityView',
  props: {
    view_id: { type: String, default: 'default' },
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  data() {
    return { editing: false };
  },
  computed: {
    view: function () {
      if (this.view_id == 'default') {
        return this.$store.state.views.views[0];
      } else {
        return this.$store.state.views.views.find(v => v.id == this.view_id);
      }
    },
  },
  methods: {
    save() {
      this.$store.dispatch('views/save');
    },
    discard() {
      this.$store.dispatch('views/load');
    },
    remove() {
      this.$store.commit('views/removeView', { view_id: this.view.id });
      // If we're on an URL that'll be invalid after removing the view, navigate to the main/default view
      if (!this.$route.path.includes('default')) {
        this.$router.replace('./default');
      }
    },
    restoreDefaults() {
      this.$store.commit('views/restoreDefaults');
      alert(
        "All views have been restored to defaults. Changes won't be saved until you click 'Save'."
      );
      // If we're on an URL that might become invalid, navigate to the main/default view
      if (!this.$route.path.includes('default')) {
        this.$router.replace('./default');
      }
    },
    addVisualization: function () {
      this.$store.commit('views/addVisualization', { view_id: this.view.id, type: 'top_apps' });
    },
    async onTypeChange(id, type) {
      await this.$store.commit('views/editView', { view_id: this.view.id, el_id: id, type });
    },
    async onRemove(id) {
      await this.$store.commit('views/removeVisualization', { view_id: this.view.id, el_id: id });
    },
  },
};
</script>
