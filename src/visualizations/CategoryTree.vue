<template lang="pug">
div
  div(v-for="cat in category_hierarchy", style="padding: 0.1em 0 0.1em 0")
    span(:style="'padding-left: ' + cat.depth + 'em'")
      span(v-if="cat.depth > 0") ⮡
      | {{cat.subname}}
    span(style="float: right")
      | {{cat.duration | friendlyduration}}
</template>

<style scoped lang="scss">
svg {
    border: 1px solid #999;
    border-radius: 0.5em;
}
</style>

<script>
const _ = require('lodash');

function count_substr(string, word) {
   return string.split(word).length - 1;
}

function get_parent_cats(cat) {
  let parents = [];
  let cs = cat.split("->").map((c) => c.trim());
  for(let i = 1; i<=cs.length; i++) {
    parents.push(cs.slice(0, i).join(" -> "));
  }
  return parents;
}

export default {
  name: "aw-categorytree",
  props: ['events'],
  computed: {
    category_hierarchy: function() {
      let events = JSON.parse(JSON.stringify(this.events));

      // Compute hierarchy for all events
      _.map(events, e => e.data["$category_hierarchy"] = get_parent_cats(e.data["$category"]));

      // Collect all categories at all depths
      let all_cat_names = _.union(_.flatten(_.map(events, (e) => e.data["$category_hierarchy"])));
      let cats = _.map(all_cat_names, (c) => {
        let depth = count_substr(c, "->");
        return {
          name: c,
          parent: c.split("->").map(s => s.trim()).slice(0, depth).join(" -> ") || null,
          subname: c.split("->").slice(-1).pop(),
          depth: depth,
          duration: _.sumBy(_.filter(events, e => e.data["$category_hierarchy"].includes(c)), e => e.duration)
        }
      });

      function _get_child_cats(cat, all_cats) {
        return _.filter(all_cats, c => c.parent == cat.name)
      }

      function _assign_children(parent, all_cats) {
        let child_cats = _get_child_cats(parent, all_cats);
        // Recurse
        _.map(child_cats, c => _assign_children(c, all_cats));
        parent.children = _.sortBy(child_cats, cc => -cc.duration);
      }

      let cats_with_depth0 = _.sortBy(_.filter(cats, c => c.depth == 0), c => -c.duration);
      _.map(cats_with_depth0, c => _assign_children(c, cats));

      // Flattens the category hierarchy
      function _flatten_hierarchy(c) {
        if(!c.children) return [];
        return _.flattenDeep([c, _.map(c.children, cc => _flatten_hierarchy(cc))]);
      }
      cats = _.flatten(_.map(cats_with_depth0, c => _flatten_hierarchy(c)));
      console.log(cats);
      // TODO: If a category has children, but also activity attributed directly to the parent that does not belong to a child, then create a "Other" child containing the activity.
      return cats;
    }
  },
}
</script>
