<template lang="pug">
// We want to use another colorscheme than the default 'schemeAccent',
// unfortunately it seems like the color-scheme prop is broken.
// See this issue: https://github.com/David-Desmaisons/Vue.D3.sunburst/issues/11
sunburst(:data="data", :colorScale="colorfunc", :getCategoryForColor="categoryForColor", :colorScheme="null" :showLabels="true")
  // Add behaviors
  template(slot-scope="{ on, actions }")
    highlightOnHover(v-bind="{ on, actions }")
    zoomOnClick(v-bind="{ on, actions }")

  // Add information to be displayed on top of the graph
  div(slot="top", slot-scope="{ nodes }")
    //nodeInfoDisplayer(:current="nodes.mouseOver" :root="nodes.root" description="time spent" :show-all-number="false")
    div.info
      div(v-if="nodes.mouseOver !== null && nodes.mouseOver")
        div.parent {{ nodes.mouseOver.data.parent ? nodes.mouseOver.data.parent.join(" > ") : " " }}
        div.name {{ nodes.mouseOver.data.name }}
        div {{ nodes.mouseOver.value | friendlyduration }}
        div ({{ Math.round(100 * nodes.mouseOver.value / nodes.root.value) }}%)

  // Add legend
  //breadcrumbTrail(slot="legend" slot-scope="{ nodes, colorGetter, width }" :current="nodes.mouseOver" :root="nodes.root" :colorGetter="colorGetter" :from="nodes.clicked" :width="width" :item-width="100" :order="0")
</template>

<script>
import {
  breadcrumbTrail,
  highlightOnHover,
  nodeInfoDisplayer,
  sunburst,
  zoomOnClick,
} from 'vue-d3-sunburst';
import 'vue-d3-sunburst/dist/vue-d3-sunburst.css';
import { getColorFromCategory } from '~/util/color';

import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';

const example_data = {
  name: 'flare',
  children: [
    {
      name: 'analytics',
      children: [
        {
          name: 'cluster',
          children: [
            { name: 'AgglomerativeCluster', size: 3938 },
            { name: 'CommunityStructure', size: 3812 },
            { name: 'HierarchicalCluster', size: 6714 },
            { name: 'MergeEdge', size: 743 },
          ],
        },
        {
          name: 'optimization',
          children: [{ name: 'AspectRatioBanker', size: 7074 }],
        },
      ],
    },
  ],
};

const SEP = '>';

export default {
  components: {
    breadcrumbTrail,
    highlightOnHover,
    nodeInfoDisplayer,
    sunburst,
    zoomOnClick,
  },
  props: {
    data: {
      type: Object,
      default: () => example_data,
    },
  },
  methods: {
    categoryForColor: function (d) {
      const category = d.parent ? d.parent.concat([d.name]) : [d.name];
      return category.join(SEP);
    },
    colorfunc: function (s) {
      // 'All' needs to be bright if light theme, and dark if dark theme
      const settings = useSettingsStore();
      if (s == 'All') return settings.theme == 'light' ? '#fff' : '#333';

      const categoryStore = useCategoryStore();
      const cat = categoryStore.get_category(s.split(SEP));
      const color = getColorFromCategory(cat, categoryStore.classes);
      return color;
    },
  },
};
</script>

<style lang="scss" scoped>
.info {
  width: 300px;
  height: 100px;
  padding: 20px;
  position: absolute;
  top: 50%;
  left: 50%;
  z-level: 10;
  pointer-events: none;
  text-align: center;
  margin-left: -150px;
  margin-top: -70px;

  .name {
    font-size: 1.5em;
  }

  .parent {
    font-size: 0.8em;
  }
}
</style>
