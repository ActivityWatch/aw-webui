<template lang="pug">
div(v-if="view")
  div.row.mb-4
    div.col-md-6.col-lg-4.p-3(v-for="el, index in view.elements")
      aw-selectable-vis(:id="index" :type="el.type" @onTypeChange="onTypeChange")

  b-button(@click="addVisualization")
    icon(name="plus")
    span Add visualization to view
</template>

<script>
export default {
  name: 'ActivityView',
  props: {
    view_id: { type: String, default: 'default' },
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  computed: {
    view: function () {
      if (this.view_id == 'default') {
        return this.$store.state.settings.views[0];
      } else {
        return this.$store.state.settings.views.find(v => v.id == this.view_id);
      }
    },
  },
  methods: {
    addVisualization: function () {
      alert('not implemented');
    },
    async onTypeChange(id, type) {
      const view_id =
        this.view_id == 'default' ? this.$store.state.settings.views[0].id : this.view_id;
      await this.$store.commit('settings/editView', { view_id: view_id, el_id: id, type });
    },
  },
};
</script>
