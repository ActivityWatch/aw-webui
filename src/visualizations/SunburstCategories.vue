<template lang="pug">
// Zoomable category sunburst. Replaces vue-d3-sunburst (Vue 2 only) with a
// small D3-backed component: hover highlights a category and its ancestors,
// clicking an arc zooms into it, clicking the center zooms back out.
div.sunburst(ref="container", @mouseleave="hovered = null")
  svg(:width="width", :height="height")
    g(:transform="`translate(${width / 2},${height / 2})`")
      path.sunburst-arc(
        v-for="node in visibleNodes",
        :key="node.key",
        :d="node.path",
        :fill="node.color",
        :fill-opacity="isHighlighted(node.node) ? 1 : highlightOpacity",
        :class="{ 'sunburst-arc--root': node.node.depth === 0 }",
        @mouseover="hovered = node.node",
        @click="zoomTo(node.node)"
      )
      text.sunburst-label(
        v-for="node in labelledNodes",
        :key="'label-' + node.key",
        :transform="node.labelTransform",
        :text-anchor="node.labelAnchor",
        :dx="node.labelAnchor === 'start' ? 5 : -5",
        dy=".35em"
      ) {{ node.label }}

  div.info
    div(v-if="hovered")
      div.parent {{ hovered.data.parent ? hovered.data.parent.join(' > ') : ' ' }}
      div.name {{ hovered.data.name }}
      div {{ friendlyduration(hovered.value) }}
      div(v-if="root") ({{ Math.round((100 * hovered.value) / root.value) }}%)
</template>

<script lang="ts">
import { markRaw } from 'vue';
import { arc, hierarchy, interpolate, partition, scaleLinear, scaleSqrt, timer } from 'd3';
import { getColorFromCategory } from '~/util/color';
import { friendlyduration } from '~/util/filters';

import { useCategoryStore } from '~/stores/categories';

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
// Arcs thinner than this (in radians) are skipped, as are their labels.
const MIN_ANGLE = 0.005;
// Used before the container has been measured (and in jsdom, which has no layout).
const FALLBACK_SIZE = 320;
const ZOOM_DURATION = 750;

function nodeKey(d): string {
  return d
    .ancestors()
    .map(n => n.data.name)
    .join(SEP);
}

export default {
  name: 'aw-sunburst-categories',
  props: {
    data: {
      type: Object,
      default: () => example_data,
    },
    showLabels: {
      type: Boolean,
      default: true,
    },
    highlightOpacity: {
      type: Number,
      default: 0.3,
    },
  },
  data() {
    return {
      width: FALLBACK_SIZE,
      height: FALLBACK_SIZE,
      hovered: null,
      zoomed: null,
      // The visible window: angles [x0, x1] and depth [y0, 1] of the partition.
      domain: { x0: 0, x1: 1, y0: 0 },
    };
  },
  computed: {
    root() {
      // null while the data is still loading
      if (!this.data) return null;
      const root = hierarchy(this.data)
        .sum(d => d.size)
        .sort((a, b) => b.value - a.value);
      // d3 nodes are large, cyclic, and never mutated after layout: keep them out of reactivity.
      return markRaw(partition()(root));
    },
    radius(): number {
      return Math.max(0, Math.min(this.width, this.height) / 2);
    },
    scales() {
      const x = scaleLinear()
        .domain([this.domain.x0, this.domain.x1])
        .range([0, 2 * Math.PI])
        .clamp(true);
      const y = scaleSqrt()
        .domain([this.domain.y0, 1])
        .range([this.domain.y0 ? 20 : 0, this.radius])
        .clamp(true);
      return { x, y };
    },
    arcGenerator() {
      const { x, y } = this.scales;
      return arc()
        .startAngle(d => x(d.x0))
        .endAngle(d => x(d.x1))
        .innerRadius(d => Math.max(0, y(d.y0)))
        .outerRadius(d => Math.max(0, y(d.y1)));
    },
    visibleNodes() {
      if (!this.root) return [];
      const { x, y } = this.scales;
      return this.root
        .descendants()
        .filter(d => x(d.x1) - x(d.x0) > MIN_ANGLE && y(d.y1) > y(d.y0))
        .map(d => ({
          node: d,
          key: nodeKey(d),
          path: this.arcGenerator(d),
          color: this.colorfunc(this.categoryForColor(d.data)),
          ...this.labelFor(d),
        }));
    },
    labelledNodes() {
      return this.showLabels ? this.visibleNodes.filter(n => n.label) : [];
    },
  },
  watch: {
    data() {
      this.zoomed = null;
      this.hovered = null;
      this.domain = { x0: 0, x1: 1, y0: 0 };
    },
  },
  mounted() {
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.$refs.container);
    }
  },
  beforeUnmount() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.zoomTimer) this.zoomTimer.stop();
  },
  methods: {
    friendlyduration,
    measure() {
      const el = this.$refs.container;
      if (!el) return;
      this.width = el.clientWidth || FALLBACK_SIZE;
      this.height = el.clientHeight || FALLBACK_SIZE;
    },
    categoryForColor(d): string {
      const category = d.parent ? d.parent.concat([d.name]) : [d.name];
      return category.join(SEP);
    },
    colorfunc(s: string): string {
      // 'All' needs to be bright if light theme, and dark if dark theme
      // (as applied, since the setting can be 'auto')
      if (s == 'All') return document.documentElement.classList.contains('dark') ? '#333' : '#fff';

      const categoryStore = useCategoryStore();
      const cat = categoryStore.get_category(s.split(SEP));
      return getColorFromCategory(cat, categoryStore.classes);
    },
    isHighlighted(d): boolean {
      if (!this.hovered) return true;
      return this.hovered.ancestors().includes(d);
    },
    labelFor(d) {
      if (d.depth === 0) return { label: null };
      const { x, y } = this.scales;
      const angle = x(d.x1) - x(d.x0);
      const r0 = y(d.y0);
      const thickness = y(d.y1) - r0;
      // Needs room for roughly one line of text along the arc, and a few characters radially.
      if (angle * (r0 + thickness / 2) < 12 || thickness < 24) return { label: null };

      const maxChars = Math.floor((thickness - 8) / 6);
      const name: string = d.data.name;
      const label = name.length > maxChars ? name.slice(0, Math.max(1, maxChars - 1)) + '…' : name;
      const textAngle = (((x(d.x0) + x(d.x1)) / 2) * 180) / Math.PI;
      return {
        label,
        labelTransform: `rotate(${textAngle - 90}) translate(${r0},0) rotate(${
          textAngle < 180 ? 0 : 180
        })`,
        labelAnchor: textAngle < 180 ? 'start' : 'end',
      };
    },
    zoomTo(d) {
      // Clicking the current center zooms back out one level.
      const target = d === this.zoomed ? d.parent : d.depth === 0 ? null : d;
      this.zoomed = target;
      const to = target ? { x0: target.x0, x1: target.x1, y0: target.y0 } : { x0: 0, x1: 1, y0: 0 };
      const interp = interpolate({ ...this.domain }, to);

      if (this.zoomTimer) this.zoomTimer.stop();
      this.zoomTimer = timer(elapsed => {
        const t = Math.min(1, elapsed / ZOOM_DURATION);
        this.domain = interp(t);
        if (t === 1) this.zoomTimer.stop();
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.sunburst {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 12em;

  svg {
    display: block;
    margin: 0 auto;
    overflow: visible;
  }
}

.sunburst-arc {
  cursor: pointer;
  stroke: #fff;
  stroke-width: 0.5px;
  transition: fill-opacity 0.1s;
}

.sunburst-label {
  font-size: 10px;
  pointer-events: none;
}

.info {
  width: 300px;
  height: 100px;
  padding: 20px;
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 10;
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
