<template lang="pug">
div
  div.row.mb-4
    div.col-md-6.col-lg-4.p-3(v-for="el, index in view.elements")
      aw-selectable-vis(:id="index" :type="el.type" @onTypeChange="onTypeChange")

  div
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
    onTypeChange(id, type) {
      // TODO: Use vuex store
      console.log(this.$store.state.settings.views);
      //this.elements[id] = type;
      // Needed to emit the change to the child component
      //this.$set(this.elements, this.elements);
    },
  },
};
</script>
