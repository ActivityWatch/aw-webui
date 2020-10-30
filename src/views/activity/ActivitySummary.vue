<template lang="pug">
div
  div.row.mb-4
    div.col-md-6.col-lg-4.p-3(v-for="view, index in views")
      aw-selectable-vis(:id="index" :type="view" @onTypeChange="onTypeChange")

  aw-devonly(v-if="periodLength === 'day'" reason="Not ready for production, still experimenting")
    div.row.mb-4
      div.col-md-12
        aw-selectable-vis(:id="index" type="timeline_barchart")
</template>

<script>
export default {
  name: 'Activity',
  props: {
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  data: function () {
    return {
      views: this.loadSummaryFavoriteViews(),
    };
  },
  methods: {
    onTypeChange(id, type) {
      this.views[id] = type;
      // Needed to emit the change to the child component
      this.$set(this.views, this.views);
      this.saveSummaryFavoriteViews();
    },

    saveSummaryFavoriteViews() {
      localStorage.activity_summary_favorite_views = JSON.stringify(this.views);
      console.log('Saved summary favorite types', localStorage.activity_summary_favorite_views);
    },

    loadSummaryFavoriteViews() {
      const favorite_views = localStorage.activity_summary_favorite_views;
      if (favorite_views) {
        return JSON.parse(favorite_views);
      } else {
        return [
          'top_apps',
          'top_titles',
          'top_domains',
          'top_categories',
          'category_tree',
          'category_sunburst',
        ];
      }
    },
  },
};
</script>
