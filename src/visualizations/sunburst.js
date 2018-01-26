// Original source: https://bl.ocks.org/kerryrodden/7090426
//
// Copyright 2013 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const d3 = require("d3");
const moment = require("moment");

const time = require("../util/time.js");
const color = require("../util/color.js");

// Dimensions of sunburst.
var width = 750;
var height = 600;
var radius = Math.min(width, height) / 2;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
  w: 75, h: 30, s: 3, t: 10
};

var legendData = {
    "afk": color.getColorFromString("afk"),
    "not-afk": color.getColorFromString("not-afk"),
    "hibernating": color.getColorFromString("hibernating"),
}

// Total size of all segments; we set this later, after loading the data.
var totalSize = 0;

var rootEl;  // The root DOM node of the graph as a d3 object
var vis;     // The root SVG node of the graph as a d3 object
var partition;
var arc;

function create(el) {
  // Clear the svg in case we are redrawing
  rootEl = d3.select(".chart");
  rootEl.selectAll("svg").remove();

  vis = rootEl.append("svg:svg")
      .attr("width", width)
      .attr("height", height)
      .append("svg:g")
      .attr("id", "container")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  drawLegend(el);

  partition = d3.partition()
      .size([2 * Math.PI, radius * radius]);

  arc = d3.arc()
      .startAngle(function(d) { return d.x0; })
      .endAngle(function(d) { return d.x1; })
      .innerRadius(function(d) { return Math.sqrt(d.y0); })
      .outerRadius(function(d) { return Math.sqrt(d.y1); });
}

function drawClockTick(a) {
  let xn = Math.cos(a);
  let yn = Math.sin(a);

  vis.append("line")
     .attr("x1", 170 * xn)
     .attr("y1", 170 * yn)
     .attr("x2", 155 * xn)
     .attr("y2", 155 * yn)
     .style("stroke", "#CCC")
     .style("stroke-width", 1);
}

function drawClock(h, m, text) {
  let a = 2 * Math.PI * ((h / 24) + (m / 24 / 60)) - (1/2 * Math.PI);
  drawClockTick(a);

  let xn = Math.cos(a);
  let yn = Math.sin(a);

  vis.append("text")
     .text(text || moment({hours: h}).format("HH:mm"))
     .attr("text-anchor", "middle")
     .attr("font-size", "1.2em")
     //.attr("font-weight", "bold")
     .style("fill", "#999")
     .attr("x", 130 * xn)
     .attr("y", 5 + 140 * yn);

}

// Main function to draw and set up the visualization, once we have the data.
function update(el, json) {
  // Basic setup of page elements.
  initializeBreadcrumbTrail();

  el.querySelector("#container").innerHTML = "";

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.
  vis.append("svg:circle")
      .attr("r", radius)
      .style("opacity", 0);

  // Turn the data into a d3 hierarchy and calculate the sums.
  var root = d3.hierarchy(json);
  var nodes = partition(root);

  let mode_clock = true;
  if(mode_clock) {
    // TODO: Make this a checkbox in the UI
    let show_whole_day = true;

    let root_start = moment(json.timestamp);
    let root_end = moment(json.timestamp).add(json.duration, "seconds");
    if(show_whole_day) {
      root_start = root_start.startOf("day");
      root_end = root_start.clone().endOf("day");

      drawClock(0, 0);
      drawClock(6, 0);
      drawClock(12, 0);
      drawClock(18, 0);

      // TODO: Draw only if showing today
      let now = moment();
      drawClock(now.hour(), now.minute(), "Now");
    }

    nodes = nodes.each(function(d) {
        let loc_start_sec = moment(d.data.timestamp).diff(root_start, "seconds", true);
        let loc_end_sec = moment(d.data.timestamp).add(d.data.duration, "seconds").diff(root_start, "seconds", true);

        let loc_start = Math.max(0, loc_start_sec / ((root_end - root_start) / 1000));
        let loc_end = Math.min(1, loc_end_sec / ((root_end - root_start) / 1000));

        d.x0 = 2 * Math.PI * loc_start;
        d.x1 = 2 * Math.PI * loc_end;
      }).descendants()
  } else {
      root = root.sum((d) => d.duration)
                 .sort((a, b) => JSON.stringify(a.data.data).localeCompare(JSON.stringify(b.data.data)));
      nodes = nodes.descendants();
  }

  // For efficiency, filter nodes to keep only those large enough to see.
  nodes = nodes.filter(function(d) {
    // 0.005 radians = 0.29 degrees
    // If show_whole_day:
    //   0.0044 rad = 1min
    //   0.0011 rad = 15s
    let threshold = 0.001;
    return (d.x1 - d.x0 > threshold);
  });

  var path = vis.data([json]).selectAll("path")
      .data(nodes)
      .enter().append("svg:path")
      .attr("display", function(d) { return d.depth ? null : "none"; })
      .attr("d", arc)
      .attr("fill-rule", "evenodd")
      .style("fill", function(d) {
          return color.getColorFromString(d.data.data.status || d.data.data.app);
      })
      .style("opacity", 1)
      .on("mouseover", mouseover)
      .on("click", mouseclick);

  // Add the mouseleave handler to the bounding circle.
  d3.select("#container").on("mouseleave", mouseleave);

  // Get total size of the tree = value of root node from partition.
  totalSize = path.datum().value;
}

function mouseclick(d) {
  console.log("Clicked");
  console.log(d);
}

function showInfo(d) {
  let hoverEl = d3.select(".explanation > .hover");

  let m = moment(d.data.timestamp);
  hoverEl.select(".date")
      .text(m.format("YYYY-MM-DD"));
  hoverEl.select(".time")
      .text(m.format("HH:mm:ss"));

  let durationString = time.seconds_to_duration(d.data.duration)
  hoverEl.select(".duration")
      .text(durationString);

  hoverEl.select(".title")
    .text(d.data.data.app || d.data.data.status);

  hoverEl.select(".data")
      .text(d.data.data.title || "");

  d3.select(".explanation > .base")
      .style("display", "none");
  hoverEl.style("visibility", "");
}

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(d) {
  showInfo(d);

  var sequenceArray = d.ancestors().reverse();
  sequenceArray.shift(); // remove root node from the array

  // Fade all the segments.
  rootEl.selectAll("path")
      .style("opacity", 0.5);

  // Then highlight only those that are an ancestor of the current segment.
  // FIXME: This currently makes all other svg paths on the page faded as well
  rootEl.selectAll("path")
      .filter(function(node) {
                return (sequenceArray.indexOf(node) >= 0);
              })
      .style("opacity", 1);
}

// Restore everything to full opacity when moving off the visualization.
function mouseleave(d) {
  // Deactivate all segments during transition.
  rootEl.selectAll("path").on("mouseover", null);

  // Transition each segment to full opacity and then reactivate it.
  rootEl.selectAll("path")
    .transition()
    .duration(100)
    .style("opacity", 1)
    .on("end", function() {
                 d3.select(this).on("mouseover", mouseover);
               });

  rootEl.select(".explanation > .base")
        .style("display", "");
  rootEl.select(".explanation > .hover")
        .style("visibility", "hidden");
}

function initializeBreadcrumbTrail() {
  // Add the svg area.
  var trail = d3.select(".sequence").append("svg:svg")
      .attr("width", width)
      .attr("height", 50)
      .attr("id", "trail");
  // Add the label at the end, for the percentage.
  trail.append("svg:text")
    .attr("id", "endlabel")
    .style("fill", "#000");
}

function drawLegend() {
  // Dimensions of legend item: width, height, spacing, radius of rounded rect.
  var li = {
    w: 75, h: 30, s: 3, r: 3
  };

  var legend = d3.select(".legend").append("svg:svg")
      .attr("width", li.w)
      .attr("height", d3.keys(legendData).length * (li.h + li.s));

  var g = legend.selectAll("g")
      .data(d3.entries(legendData))
      .enter().append("svg:g")
      .attr("transform", function(d, i) {
              return "translate(0," + i * (li.h + li.s) + ")";
           });

  g.append("svg:rect")
      .attr("rx", li.r)
      .attr("ry", li.r)
      .attr("width", li.w)
      .attr("height", li.h)
      .style("fill", function(d) { return d.value; });

  g.append("svg:text")
      .attr("x", li.w / 2)
      .attr("y", li.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(function(d) { return d.key; });
}

// NOTE: The original version of this sunburst contained a buildHierarchy
//       function that's not used in our version.

export default {
    "create": create,
    "update": update
}
