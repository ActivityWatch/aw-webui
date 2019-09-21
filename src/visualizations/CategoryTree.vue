<template lang="pug">
div
  div(v-for="cat in category_hierarchy", style="padding: 0.1em 0 0.1em 0")
    span(:style="'padding-left: ' + cat.depth + 'em'")
      span(v-if="cat.depth > 0") ⮡
      | {{cat.subname}}
    span(style="float: right") {{cat.duration | friendlyduration}}
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
  props: ['categories'],
  computed: {
    category_hierarchy: function() {
      let events = JSON.parse(JSON.stringify(this.categories));

      // Compute hierarchy for all events
      _.map(events, e => e.data["$category_hierarchy"] = get_parent_cats(e.data["$category"]));

      // Collect all categories at all depths
      let categories = _.union(_.flatten(_.map(events, (e) => e.data["$category_hierarchy"])));

      let cat_time = _.map(categories, (c) => {
        return {
          name: c,
          subname: c.split("->").slice(-1).pop(),
          depth: count_substr(c, "->"),
          duration: _.sumBy(_.filter(events, e => e.data["$category_hierarchy"].includes(c)), e => e.duration)
        }
      });
      console.log(cat_time);

      return cat_time;
    }
  },
  mounted: function() {
  },
  watch: {
  }
}
</script>
