<template lang="pug">
div(v-if="view")
  div(v-if="view.id == 'editor'")
    ActivityEditor

  div.row
    div.col-md-6.col-lg-4.p-3(v-for="el, index in view.elements")
      aw-selectable-vis(:id="index" :type="el.type" @onTypeChange="onTypeChange" @onRemove="onRemove" :editable="editing")

    div.col-md-6.col-lg-4.p-3(v-if="editing")
      b-button(@click="addVisualization" variant="outline-dark" block size="lg")
        icon(name="plus")
        span Add visualization

  div.d-flex.flex-row-reverse.mt-2
    div(v-if="editing")
      b-button(variant="success" @click="save(); editing = !editing;")
        icon(name="save")
        span Save
      b-button.ml-2(variant="outline-dark" @click="discard(); editing = !editing;")
        icon(name="times")
        span Cancel
    b-button(v-else variant="outline-dark" size="sm" @click="editing = !editing")
      icon(name="edit")
      span Edit view
</template>

<script>
import ActivityEditor from '~/views/activity/ActivityEditor';

export default {
  name: 'ActivityView',
  components: { ActivityEditor: ActivityEditor },
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
    addVisualization: function () {
      const view_id =
        this.view_id == 'default' ? this.$store.state.views.views[0].id : this.view_id;
      this.$store.commit('views/addVisualization', { view_id, type: 'top_apps' });
    },
    async onTypeChange(id, type) {
      const view_id =
        this.view_id == 'default' ? this.$store.state.views.views[0].id : this.view_id;
      await this.$store.commit('views/editView', { view_id: view_id, el_id: id, type });
    },
    async onRemove(id) {
      console.log('rem');
      const view_id =
        this.view_id == 'default' ? this.$store.state.views.views[0].id : this.view_id;
      await this.$store.commit('views/removeVisualization', { view_id: view_id, el_id: id });
    },
  },
};
</script>
