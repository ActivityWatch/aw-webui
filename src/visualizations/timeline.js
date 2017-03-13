"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

import event_parsing from "../util/event_parsing";
import color from "../util/color.js"

var time = require("../util/time.js");

function renderTimeline(el, events, total_duration) {
  // Clear element
  el.innerHTML = "";

  // Animation functions for setting hover color and titlebox content
  var elem = document.createElement("script");
  elem.text =  'function set_color(elem_id, color) {'
  elem.text += '  var rect = document.getElementById(elem_id).children[0];'
  elem.text += '  rect.style.fill = color;'
  elem.text += '};'
  elem.text += 'function show_info(elem_id) {'
  elem.text += '  var title_event_box = document.getElementById(elem_id);'
  elem.text += '  var titleinfo = document.getElementById("titleinfo");'
  elem.text += '  titleinfo.innerHTML = title_event_box.innerHTML;'
  elem.text += '  titleinfo.style.height = title_event_box.getAttribute("height");'
  elem.text += '};'
  el.appendChild(elem);

  // svg for the colored timeline
  let timeline = d3.select(el).append("svg")
    .attr("viewBox", "0 0 100 10")
    .attr("width", "100%");

  // Hidden svg image that stores all titleinfo for each timeperiod
  let titleinfolist = d3.select(el).append("svg")
    .attr("display", "none");

  // Container for titleinfo that has a fixed size and a overflow scroll
  let titleinfo_container = document.createElement("div");
  titleinfo_container.style.width = "100%";
  titleinfo_container.style.height = "200px";
  titleinfo_container.style.overflowY = "scroll";
  el.appendChild(titleinfo_container);

  // Titleinfo box that changes content depending on what was timeperiod was last recently hovered on
  let titleinfo = d3.select(titleinfo_container).append("svg")
    .attr("width", "100%")
    .attr("id", "titleinfo");

  // Iterate over each app timeperiod
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
     .attr("onmouseover", "set_color('timeline_event_"+i+"', '"+hovercolor+"'); show_info('titleinfo_event_"+i+"')")
     .attr("onmouseout", "set_color('timeline_event_"+i+"', '"+appcolor+"')")
     .style("fill", color.getAppColor(e.appname));

    // Titleinfo box
    var infobox = titleinfolist.append("g")
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
      var clocktime = t.timestamp[0].split("T")[1].split(".")[0];
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

    curr_x += e_width
  });

  return el;
}

module.exports = renderTimeline;
