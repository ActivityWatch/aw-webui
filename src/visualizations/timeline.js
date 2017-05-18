"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

import event_parsing from "../util/event_parsing";
import color from "../util/color.js"

var time = require("../util/time.js");

function _appendTitleSvg(container, events) {
  let svg = container.append("svg")
    .attr("width", "100%")
    .attr("id", "titleinfo");

  // Hidden svg image that stores all titleinfo for each timeperiod
  let titleinfolist = container.append("svg")
    .attr("display", "none");

  // There are better ways to do this than with CSV, a simple <table> would work.
  // Iterate over each app timeperiod
  _.each(events, function(e, i) {
    // Titleinfo box
    var infobox = svg.append("g")
      .attr("id", "titleinfo_event_"+i)

    // Appname and duration text
    infobox.append("text")
      .attr("x", "10px")
      .attr("y", "20px")
      .text(e.appname + " (" + time.seconds_to_duration(e.duration) + ")")
      .attr("font-family", "sans-serif")
      .attr("font-size", "20px")
      .attr("fill", "black");

    // Titleinfo
    var curr_y = 45
    _.each(e.titles, function(t, i){
      // Clocktime
      var clocktime = t.timestamp.split("T")[1].split(".")[0];
      infobox.append("text")
        .attr("x", "10px")
        .attr("y", curr_y+"px")
        .text(clocktime)
        .attr("font-family", "sans-serif")
        .attr("font-size", "15px")
      // Duration
      var duration = time.seconds_to_duration(t.duration);
      infobox.append("text")
        .attr("x", "100px")
        .attr("y", curr_y+"px")
        .text(duration)
        .attr("font-family", "sans-serif")
        .attr("font-size", "15px")
      // Title
      infobox.append("text")
        .attr("x", "170px")
        .attr("y", curr_y+"px")
        .text(t.title)
        .attr("font-family", "sans-serif")
        .attr("font-size", "15px")
      curr_y += 20;
    });
    infobox.attr("height", curr_y+"px");
  });

  // Container for titleinfo that has a fixed size and a overflow scroll
  let titleInfo = container.append("div");
  titleInfo.style.width = "100%";
  titleInfo.style.height = "200px";
  titleInfo.style.overflowY = "scroll";

  return svg;
}

function renderTimeline(selector, events, total_duration) {
  // Clear element
  var target_el = d3.select(selector);
  target_el.selectAll("*").remove();

  // svg for the colored timeline
  let timeline = target_el.append("svg")
    .attr("viewBox", "0 0 100 10")
    .attr("width", "100%");

  if (events.length <= 0){
    timeline.append("text")
     .attr("x", "0")
     .attr("y", "3")
     .text("No data")
     .attr("font-family", "sans-serif")
     .attr("font-size", "3")
     .attr("fill", "black")
  }


  // Helper functions used when hover state changes.
  function set_color(elem_id, color) {
    var rect = document.getElementById(elem_id).children[0];
    rect.style.fill = color;
  };
  function show_info(elem_id) {
    console.log("show_info called with args: " + elem_id);
    var title_event_box = document.getElementById(elem_id);
    var titleinfo = document.getElementById("titleinfo");
    console.log(title_event_box);
    console.log(titleinfo);
    titleinfo.innerHTML = title_event_box.innerHTML;
    titleinfo.style.height = title_event_box.getAttribute("height");
  };

  // Build timeline
  let curr_x = 0;
  _.each(events, function(e, i) {
    let eg = timeline.append("g")
      .attr("id", "timeline_event_"+i);

    // Timeline rect
    var e_width = e.duration / total_duration * 100;
    var appcolor = color.getAppColor(e.appname);
    var hovercolor = Color(appcolor).darken(0.4).rgbString();
    eg.append("rect")
      .attr("x", curr_x)
      .attr("y", 0)
      .attr("width", e_width)
      .attr("height", 10)
      .style("fill", color.getAppColor(e.appname))
      .on("mouseover", function() {
          set_color("timeline_event_" + i, hovercolor);
          show_info("titleinfo_event_" + i);
      })
      .on("mouseout", function() {
          set_color('timeline_event_' + i, +appcolor);
      })
    curr_x += e_width
  });

  _appendTitleSvg(target_el, events)

  return target_el;
}

module.exports = renderTimeline;
