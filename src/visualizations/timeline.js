"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

import event_parsing from "../util/event_parsing";

var time = require("../util/time.js");

// Whenever a appname is found without a color in this dict, create one and assign
let appname_colors = {};
var color = Color('#F44')
function getColor(appname) {
  if(!(appname in appname_colors)) {
    appname_colors[appname] = color.rgbString();
    color.hue(color.hue() + 90);
  }
  return appname_colors[appname];
}

function test(){
  document.body.style.backgroundcolor = "#fff"
}

function renderTimeline(el, events, total_duration) {
  // Clear element
  el.innerHTML = "";

  var elem = document.createElement('script');
  elem.text = 'function set_color(elem_id, color) { var rect = document.getElementById(elem_id).children[0]; rect.style.fill = color; }';
  elem.text += 'function show_info(elem_id) { var elem_info = document.getElementById(elem_id).children[1]; var info_box = document.getElementById("gi"); info_box.innerHTML = elem_info.innerHTML }'
  el.appendChild(elem);

  let svg = d3.select(el).append("svg");
  svg.attr("viewBox", "0 0 100 50");

  let g = svg.append("g");
  g.attr("width", "100%");

  let gi = svg.append("g")
    .attr("id", "gi");

  let curr_x = 0;
  _.each(events, function(e, i) {
    let eg = g.append("g");
    eg.attr("id", "timeline_event_"+i);
    // TODO: Also render titles when clicked

    var e_width = e.duration / total_duration * 100
    var color = getColor(e.appname);
    var hovercolor = Color(color).lighten(0.3).rgbString()
    eg.append("rect")
     .attr("x", curr_x)
     .attr("y", 0)
     .attr("width", e_width)
     .attr("height", 10)
     .attr("onmouseover", "set_color('timeline_event_"+i+"', '"+hovercolor+"'); show_info('timeline_event_"+i+"')")
     .attr("onmouseout", "set_color('timeline_event_"+i+"', '"+color+"')")
     .style("fill", getColor(e.appname));

    var infobox = eg.append("g")
      .style("display", "none");

    console.log(e.timestamp)
    infobox.append("text")
      .attr("x", 2)
      .attr("y", 13)
      .text(e.appname + " (" + time.seconds_to_duration(e.duration) + ")")
      .attr("font-family", "sans-serif")
      .attr("font-size", 2)
      .attr("fill", "black")

    var curr_y = 15.5
    _.each(e.titles, function(t, i){
      var clocktime = t.timestamp[0].split("T")[1].split(".")[0]
      var duration = time.seconds_to_duration(t.duration)
      infobox.append("text")
        .attr("x", 2)
        .attr("y", curr_y)
        .text(clocktime + " - " + duration + " - " + t.title)
        .attr("font-family", "sans-serif")
        .attr("font-size", 1.8)
        .attr("fill", "black")
      curr_y += 2
    });

    curr_x += e_width


  });

  return svg;
}

module.exports = renderTimeline;

