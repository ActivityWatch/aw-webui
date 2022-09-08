<template lang="pug">
div#forcegraph
</template>

<style>
#forcegraph > svg {
  border: 1px solid #555;
}
</style>

<script lang="ts">
import * as d3 from 'd3';

export default {
  name: 'ForceGraph',
  props: {
    data: {
      type: Object,
      required: true,
    },
  },
  data: () => ({
    cancelPromise: null,
  }),
  watch: {
    // Watch for changes in the data and update the graph
    data() {
      this.drawGraph(this.data);
    },
  },
  mounted() {
    this.drawGraph(this.data);
  },
  methods: {
    drawGraph({ nodes, links }) {
      console.log('rendering...');
      this.cancelPromise && this.cancelPromise();
      const promise = new Promise(resolve => {
        this.cancelPromise = resolve;
      });

      const svgEl = ForceGraph({ nodes, links }, { invalidation: promise });
      const svg = d3.select('#forcegraph');
      //clear
      svg.selectAll('*').remove();
      //append
      svg.node().appendChild(svgEl);
      console.log('drawn!');
    },
  },
};

// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/force-directed-graph
function ForceGraph(
  {
    nodes, // an iterable of node objects (typically [{id}, …])
    links, // an iterable of link objects (typically [{source, target}, …])
  },
  {
    nodeId = d => d.id, // given d in nodes, returns a unique identifier (string)
    nodeGroup = d => d.group, // given d in nodes, returns an (ordinal) value for color
    nodeGroups, // an array of ordinal values representing the node groups
    nodeTitle = d => d.id.split('>').slice(-1), // given d in nodes, a title string
    nodeFill = 'currentColor', // node stroke fill (if not using a group color encoding)
    nodeStroke = '#fff', // node stroke color
    nodeStrokeWidth = 1.5, // node stroke width, in pixels
    nodeStrokeOpacity = 1, // node stroke opacity
    nodeRadius = 4, // node radius, in pixels
    nodeStrength,
    linkSource = ({ source }) => source, // given d in links, returns a node identifier string
    linkTarget = ({ target }) => target, // given d in links, returns a node identifier string
    linkStroke = '#999', // link stroke color
    linkStrokeOpacity = 0.6, // link stroke opacity
    linkStrokeWidth = d => 1.5 * Math.sqrt(d.value), // given d in links, returns a stroke width in pixels
    linkStrokeLinecap = 'round', // link stroke linecap
    linkStrength = d => {
      // if low value, link should push nodes apart
      // if high value, link should pull nodes together
      if (d.value < 10) {
        return 0.01;
      } else {
        return Math.sqrt(1 / (2 + d.value));
      }
    }, // given d in links, returns a link strength
    colors = d3.schemeTableau10, // an array of color strings, for the node groups
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    invalidation, // when this promise resolves, stop the simulation
  } = {}
) {
  // Compute values.
  const N = d3.map(nodes, nodeId).map(intern);
  const LS = d3.map(links, linkSource).map(intern);
  const LT = d3.map(links, linkTarget).map(intern);
  if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
  const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
  const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);
  const W = typeof linkStrokeWidth !== 'function' ? null : d3.map(links, linkStrokeWidth);
  const L = typeof linkStroke !== 'function' ? null : d3.map(links, linkStroke);

  // Replace the input nodes and links with mutable objects for the simulation.
  nodes = d3.map(nodes, (node, i) => ({ id: N[i], color: node.color, value: node.value }));
  links = d3.map(links, (link, i) => ({ source: LS[i], target: LT[i], value: link.value }));

  // Scale so that the area of each node is ~proportional to the time value
  nodes = nodes.map(d => {
    d.radius = nodeRadius + 5 * Math.sqrt(d.value / 60 / 60);
    return d;
  });

  // Compute default domains.
  if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);

  // Construct the scales.
  const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

  // Construct the forces.
  const forceNode = d3.forceManyBody();
  const forceLink = d3.forceLink(links).id(({ index: i }) => N[i]);
  if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
  if (linkStrength !== undefined) forceLink.strength(linkStrength);

  const simulation = d3
    .forceSimulation(nodes)
    .force('link', forceLink)
    .force('charge', forceNode)
    .force('center', d3.forceCenter())
    .force(
      'collision',
      d3.forceCollide(d => d.radius)
    )
    .on('tick', ticked);

  const svg = d3
    .create('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .attr('style', 'max-width: 100%; height: auto; height: intrinsic;');

  const link = svg
    .append('g')
    .attr('stroke', typeof linkStroke !== 'function' ? linkStroke : null)
    .attr('stroke-opacity', linkStrokeOpacity)
    .attr('stroke-width', typeof linkStrokeWidth !== 'function' ? linkStrokeWidth : null)
    .attr('stroke-linecap', linkStrokeLinecap)
    .selectAll('line')
    .data(links)
    .join('line');

  const node = svg
    .append('g')
    .attr('fill', nodeFill)
    .attr('stroke', nodeStroke)
    .attr('stroke-opacity', nodeStrokeOpacity)
    .attr('stroke-width', nodeStrokeWidth)
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', d => d.radius)
    .call(drag(simulation));

  if (W) link.attr('stroke-width', ({ index: i }) => W[i]);
  if (L) link.attr('stroke', ({ index: i }) => L[i]);
  //if (G) node.attr('fill', ({ index: i }) => color(G[i]));
  node.attr('fill', ({ index: i }) => nodes[i].color);
  if (T) node.append('title').text(({ index: i }) => T[i]);
  if (invalidation != null) invalidation.then(() => simulation.stop());

  function intern(value) {
    return value !== null && typeof value === 'object' ? value.valueOf() : value;
  }

  function ticked() {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr('cx', d => d.x).attr('cy', d => d.y);
  }

  function drag(_simulation) {
    function dragstarted(event) {
      if (!event.active) _simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) _simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
  }

  return Object.assign(svg.node(), { scales: { color } });
}
</script>
