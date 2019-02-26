"use strict";

/*
 * Creates a colored timeline where you can hover for more info.
 */

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");
const moment = require("moment");

import {getColorFromString} from "../util/color.js"

import time from "../util/time.js";

function show_info(container, elem_id) {
  var title_event_box = container.querySelector("#"+elem_id);
  var titleinfo = container.querySelector(".titleinfo-container");
  titleinfo.innerHTML = title_event_box.innerHTML;
  titleinfo.style.height = title_event_box.getAttribute("height");
}

function create(container) {
  // Clear element
  container.innerHTML = "";

  // svg for the colored timeline
  d3.select(container).append("svg")
    .attr("class", "apptimeline")
    .attr("viewBox", "0 0 100 10")
    .attr("width", "100%");

  // Hidden svg image that stores all titleinfo for each timeperiod
  d3.select(container).append("div")
    .attr("class", "titleinfo-list")
    .attr("display", "none");

  // Container for titleinfo that has a fixed size and a overflow scroll
  let titleinfo_container = document.createElement("div");
  titleinfo_container.style.width = "100%";
  titleinfo_container.style.height = "200px";
  titleinfo_container.style.overflowY = "scroll";
  container.appendChild(titleinfo_container);

  // Titleinfo box that changes content depending on what was timeperiod was last recently hovered on
  d3.select(titleinfo_container).append("div")
      .attr("width", "100%")
      .attr("class", "titleinfo-container");
}

function set_status(container, text){
  let timeline_elem = container.querySelector(".apptimeline");
  let titleinfo_list_elem = container.querySelector(".titleinfo-list");
  let titleinfo_container_elem = container.querySelector(".titleinfo-container");

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

function update(container, events, total_duration, showAFK, chunkfunc, eventfunc){
  let timeline = d3.select(container.querySelector(".apptimeline")).html(null);
  let titleinfo_list = d3.select(container.querySelector(".titleinfo-list")).html(null);
  d3.select(container.querySelector(".titleinfo-container")).html(null);

  if (events.length <= 0){
    set_status(container, "No data");
    return;
  }

  if(showAFK) {
    var firstEvent = events[0];
    var lastEvent = events[events.length-1];

    var timeStart = moment(firstEvent.timestamp);
    var timeEnd = moment(lastEvent.timestamp).add(lastEvent.duration, "seconds");

    var secSinceStart = timeEnd.diff(timeStart, "seconds", true);

    // If we want to show from 00:00
    //timeStart = timeStart.startOf('day');
  }

  // Iterate over each app timeperiod
  let curr_x = 0;
  _.each(events, function(e, i) {
    // Timeline rect

    let eventX, eventWidth;
    if(showAFK) {
      let eventBegin = moment(e.timestamp);
      eventX = eventBegin.diff(timeStart, "seconds", true) / secSinceStart;
      eventX = eventX * 100 + "%";
      eventWidth = e.duration / secSinceStart * 100 + "%";
    } else {
      eventX = curr_x;
      eventWidth = e.duration / total_duration * 100;
    }

    var appcolor = getColorFromString(chunkfunc(e));
    var hovercolor = Color(appcolor).darken(0.4).hex();

    let eg = timeline.append("g")
      .attr("id", "timeline_event_"+i);

    let rect = eg.append("rect")
      .attr("x", eventX)
      .attr("y", 0)
      .attr("width", eventWidth)
      .attr("height", 10)
      .style("fill", appcolor)
      .on("mouseover", () => {
          rect.style("fill", hovercolor);
          show_info(container, "titleinfo_event_" + i);
      })
      .on("mouseout", () => {
          rect.style("fill", appcolor);
      })

    // Titleinfo box
    var infobox = titleinfo_list.append("div")
      .attr("id", "titleinfo_event_"+i)
      .style("display", "none");

    // Appname and duration text
    infobox.append("h5")
      .attr("x", "10px")
      .attr("y", "20px")
      .text(chunkfunc(e) + " (" + time.seconds_to_duration(e.duration) + ")")
      .attr("font-family", "sans-serif")
      .attr("font-size", "20px")
      .attr("fill", "black");

    // Titleinfo
    var infolist = infobox.append("table");
    _.each(e.data.subevents, function(t) {
      var inforow = infolist.append("tr");
      // Clocktime
      var clocktime = moment(t.timestamp).format("HH:mm:ss");
      inforow.append("td")
        .text(clocktime);
      // Duration
      var duration = time.seconds_to_duration(t.duration);
      inforow.append("td")
        .text(duration)
        .style("padding-left", "1em")
        .style("text-align", "right");
      // Title
      inforow.append("td")
        .text(eventfunc(t))
        .style("padding-left", "1em");
    });

    curr_x += eventWidth;
  });

  return container;
}

export default {
  "create": create,
  "update": update,
  "set_status": set_status,
};
