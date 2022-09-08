<template lang="pug">
div(style="font-size: 0.9em")
  div.px-1(v-for="cat in category_hierarchy" @click="toggle(cat)" v-if="parents_expanded(cat)", :class="{'clickable': cat.children.length > 0}")
    span(:style="'padding-left: ' + (1.4 * cat.depth) + 'em'")

      // icon
      span(v-if="cat.children.length > 0", style="opacity: 0.8")
        b(v-if="!expanded.has(cat.name_pretty)")
          icon.mr-1(name="regular/plus-square", scale="0.8")
        b(v-else)
          icon.mr-1(name="regular/minus-square", scale="0.8")
      span(v-else, style="opacity: 0.6")
        icon(name="circle", scale="0.4", style="margin-left: 1em; margin-right: 1.22em;")

      // title
      | {{cat.subname}}

    // time
    span(style="float: right")
      span(v-if="show_perc")
        | {{Math.round(100 * cat.duration / total_duration, 1)}}%
      span(v-else)
        | {{cat.duration | friendlyduration}}
  hr
  // TODO: Make configurable in a cleaner way (figure out a way to configure visualizations generally)
  b-checkbox(v-model="show_perc" size="sm") Show percent
</template>

<style lang="scss" scoped>
.clickable {
  cursor: pointer;
}
</style>

<script>
import 'vue-awesome/icons/circle';
import 'vue-awesome/icons/regular/plus-square';
import 'vue-awesome/icons/regular/minus-square';
const _ = require('lodash');
const classes = require('~/util/classes.ts');

function _get_child_cats(cat, all_cats) {
  return _.filter(all_cats, c => _.isEqual(c.parent, cat.name));
}

function _assign_children(parent, all_cats) {
  const child_cats = _get_child_cats(parent, all_cats);
  // Recurse
  _.map(child_cats, c => _assign_children(c, all_cats));
  parent.children = _.sortBy(child_cats, cc => -cc.duration);
}

// Flattens the category hierarchy
function _flatten_hierarchy(c) {
  if (!c.children) return [];
  return _.flattenDeep([c, _.map(c.children, cc => _flatten_hierarchy(cc))]);
}

export default {
  name: 'aw-categorytree',
  props: {
    events: { type: Array },
  },
  data: function () {
    return {
      expanded: new Set(),
      show_perc: false,
    };
  },
  computed: {
    total_duration: function () {
      // sum top-level categories
      const top_c = _.filter(this.category_hierarchy, c => c.depth == 0);
      return _.sumBy(top_c, c => c.duration);
    },
    category_hierarchy: function () {
      if (!this.events) return [];
      const events = JSON.parse(JSON.stringify(this.events));

      const hier = classes.build_category_hierarchy(
        _.map(events, e => {
          return { name: e.data['$category'] };
        })
      );

      let cats = classes.flatten_category_hierarchy(hier).map(c => {
        c.duration = _.sumBy(
          events.filter(e => {
            const pcat = e.data['$category'].slice(0, c.name.length);
            return _.isEqual(c.name, pcat);
          }),
          e => e.duration
        );
        return c;
      });

      const cats_with_depth0 = _.sortBy(
        _.filter(cats, c => c.depth == 0),
        c => -c.duration
      );
      _.map(cats_with_depth0, c => _assign_children(c, cats));

      cats = _.flatten(_.map(cats_with_depth0, c => _flatten_hierarchy(c)));
      //console.log(cats);
      // TODO: If a category has children, but also activity attributed directly to the parent that does not belong to a child, then create a "Other" child containing the activity.
      return cats;
    },
  },
  methods: {
    get_category: function (cat_arr) {
      return _.find(this.category_hierarchy, c => _.isEqual(c.name, cat_arr));
    },
    toggle: function (cat) {
      if (this.expanded.has(cat.name_pretty)) {
        this.expanded.delete(cat.name_pretty);
      } else {
        this.expanded.add(cat.name_pretty);
      }
      // needed to trigger update, since Set isn't reactive in Vue 2
      this.expanded = new Set(this.expanded);
    },
    parents_expanded: function (cat) {
      if (cat === undefined || !cat.parent) {
        // top-level category
        return true;
      }
      return (
        // Check grandparents recursively
        this.parents_expanded(this.get_category(cat.parent)) &&
        // Check parent
        this.expanded.has(cat.parent.join('>'))
      );
    },
  },
};
</script>
