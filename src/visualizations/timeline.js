"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

import event_parsing from "../util/event_parsing";
import color from "../util/color.js"

var time = require("../util/time.js");

/*
 * script
 * apptimeline
 * titleinfo_list (hidden titleinfo)
 * titleinfo-container (visible titleinfo)
 * */

function create(container) {
  // Clear element
  container.innerHTML = "";

  // Animation functions for setting hover color and titlebox content
  var elem = document.createElement("script");
  elem.text =  'function set_color(elem_id, color) {'
  elem.text += '  var rect = document.getElementById(elem_id).children[0];'
  elem.text += '  rect.style.fill = color;'
  elem.text += '};'
  elem.text += 'function show_info(elem_id) {'
  elem.text += '  var title_event_box = document.getElementById(elem_id);'
  elem.text += '  var titleinfo = document.getElementById("titleinfo-container");'
  elem.text += '  titleinfo.innerHTML = title_event_box.innerHTML;'
  elem.text += '  titleinfo.style.height = title_event_box.getAttribute("height");'
  elem.text += '};'
  container.appendChild(elem);

  // svg for the colored timeline
  let timeline = d3.select(container).append("svg")
    .attr("viewBox", "0 0 100 10")
    .attr("width", "100%")
    .attr("class", "apptimeline");

  // Hidden svg image that stores all titleinfo for each timeperiod
  let titleinfo_list = d3.select(container).append("div")
    .attr("display", "none")
    .attr("class", "titleinfo_list");

  // Container for titleinfo that has a fixed size and a overflow scroll
  let titleinfo_container = document.createElement("div");
  titleinfo_container.style.width = "100%";
  titleinfo_container.style.height = "200px";
  titleinfo_container.style.overflowY = "scroll";
  container.appendChild(titleinfo_container);

  // Titleinfo box that changes content depending on what was timeperiod was last recently hovered on
  let titleinfo = d3.select(titleinfo_container).append("div")
    .attr("width", "100%")
    .attr("id", "titleinfo-container");
}

function set_status(container, text){
  let timeline_elem = container.querySelector(".apptimeline");
  let titleinfo_list_elem = container.querySelector(".titleinfo_list");
  let titleinfo_container_elem = container.querySelector("#titleinfo-container");

  let timeline = d3.select(timeline_elem);
  timeline_elem.innerHTML = "";
  titleinfo_list_elem.innerHTML = "";
  titleinfo_container_elem.innerHTML = "";

  timeline.append("text")
   .attr("x", "0")
   .attr("y", "3")
   .text(text)
   .attr("font-family", "sans-serif")
   .attr("font-size", "3")
   .attr("fill", "black")
}

function update(container, events, total_duration){
  let timeline_elem = container.querySelector(".apptimeline");
  let titleinfo_list_elem = container.querySelector(".titleinfo_list");
  let titleinfo_container_elem = container.querySelector("#titleinfo-container");

  let timeline = d3.select(timeline_elem);
  timeline_elem.innerHTML = "";

  let titleinfo_list = d3.select(titleinfo_list_elem);
  titleinfo_list_elem.innerHTML = "";

  let titleinfo_container = d3.select(titleinfo_container_elem);
  titleinfo_container_elem.innerHTML = "";

  if (events.length <= 0){
    set_status(container, "No data");
    return;
  }


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
    var infobox = titleinfo_list.append("div")
      .attr("id", "titleinfo_event_"+i)
      .style("display", "none");

    // Appname and duration text
    infobox.append("h4")
      .attr("x", "10px")
      .attr("y", "20px")
      .text(e.appname + " (" + time.seconds_to_duration(e.duration) + ")")
      .attr("font-family", "sans-serif")
      .attr("font-size", "20px")
      .attr("fill", "black");

    // Titleinfo
    var infolist = infobox.append("table");
    _.each(e.titles, function(t, i){
      var inforow = infolist.append("tr");
      // Clocktime
      var clocktime = t.timestamp.split("T")[1].split(".")[0];
      inforow.append("td")
        .text(clocktime);
      // Duration
      var duration = time.seconds_to_duration(t.duration);
      inforow.append("td")
        .text(duration)
        .style("padding-left", "1em");
      // Title
      inforow.append("td")
        .text(t.title)
        .style("padding-left", "1em");
    });

    curr_x += e_width
  });

  return container;
}

module.exports = {
  "create": create,
  "update": update,
  "set_status": set_status,
};
