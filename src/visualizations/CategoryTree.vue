<template lang="pug">
div
  div(v-for="cat in category_hierarchy", style="padding: 0.1em 0 0.1em 0")
    span(:style="'padding-left: ' + (1.4 * cat.depth - 1) + 'em'")
      span(v-if="cat.depth > 0", style="opacity: 0.7") #[icon.mr-1(name="caret-right")]
      | {{cat.subname}}
    span(style="float: right")
      | {{cat.duration | friendlyduration}}
</template>

<script>
import 'vue-awesome/icons/caret-right';
const _ = require('lodash');
const classes = require('~/util/classes.ts');

export default {
  name: 'aw-categorytree',
  props: {
    events: { type: Array },
  },
  computed: {
    category_hierarchy: function () {
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

      function _get_child_cats(cat, all_cats) {
        return _.filter(all_cats, c => _.isEqual(c.parent, cat.name));
      }

      function _assign_children(parent, all_cats) {
        const child_cats = _get_child_cats(parent, all_cats);
        // Recurse
        _.map(child_cats, c => _assign_children(c, all_cats));
        parent.children = _.sortBy(child_cats, cc => -cc.duration);
      }

      const cats_with_depth0 = _.sortBy(
        _.filter(cats, c => c.depth == 0),
        c => -c.duration
      );
      _.map(cats_with_depth0, c => _assign_children(c, cats));

      // Flattens the category hierarchy
      function _flatten_hierarchy(c) {
        if (!c.children) return [];
        return _.flattenDeep([c, _.map(c.children, cc => _flatten_hierarchy(cc))]);
      }
      cats = _.flatten(_.map(cats_with_depth0, c => _flatten_hierarchy(c)));
      //console.log(cats);
      // TODO: If a category has children, but also activity attributed directly to the parent that does not belong to a child, then create a "Other" child containing the activity.
      return cats;
    },
  },
};
</script>
