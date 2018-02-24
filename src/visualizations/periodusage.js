"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

import color from "../util/color.js";

var time = require("../util/time.js");

function create(svg_elem){
  // Clear element
  svg_elem.innerHTML = "";
}

function set_status(svg_elem, msg){
  // Select svg canvas
  svg_elem.innerHTML = "";
  let svg = d3.select(svg_elem);

  svg.append("text")
   .attr("x", "5pt")
   .attr("y", "25pt")
   .text(msg)
   .attr("font-family", "sans-serif")
   .attr("font-size", "20pt")
   .attr("fill", "black");
}

var diagramcolor = "#46f"
var center_diagramcolor = "#8cf"
var focused_diagramcolor = "#adf"

function update(svg_elem, usage_arr, host) {
  // No apps, sets status to "No data"
  if (usage_arr.length <= 0){
    set_status(svg_elem, "No data");
    return svg;
  }
  svg_elem.innerHTML = "";
  var svg = d3.select(svg_elem);

  function get_usage_time(day_events){
    var day_event = _.head(_.filter(day_events, (e) => e.data.status == "not-afk"));
    return day_event != undefined ? day_event.duration : 0;
  }

  var usage_times = usage_arr.map(day_events => get_usage_time(day_events));
  var longest_usage = Math.max.apply(null, usage_times);
  // Avoid division by zero
  if (longest_usage <= 0){
    longest_usage = 0.00000000001;
  }

  var padding = (100 / (usage_arr.length-1))/10;
  var width = (100/usage_arr.length) - padding;
  var center_elem = Math.floor(usage_arr.length/2);

  for (var i in usage_arr){
    var usage_time = get_usage_time(usage_arr[i]);
    var height = 100*(usage_time / longest_usage);
    var date = "";
    if (usage_arr[i].length > 0){
      /* slice off so it's only the day */
      date = usage_arr[i][0].timestamp.slice(0,10);
    }
    var color = (i == center_elem) ? center_diagramcolor : diagramcolor;

    let rect = svg.append("rect")
      .attr("x", padding*(i-1)+width*i+"%")
      .attr("y", 100-height+"%") // Draw rect bottom-up
      .attr("width", width+"%")
      .attr("height", height+"%")
      .attr("color", color)
      .attr("date", date)
      .attr("host", host)
      .style("fill", color)
      .on("mouseover", () => {
          rect.style("fill", focused_diagramcolor);
      })
      .on("mouseout", (d, i, n) => {
          var a = n[i];
          rect.style("fill", a.getAttribute("color"));
      })
      .on("click", function(d, i, n) {
        var me = n[i];
        var host = d3.select(me).attr('host');
        var day = d3.select(me).attr('date');
        var url = '/#/activity/'+host+'/'+day;
        /* Not the vue-way, but works */
        window.location.assign(url);
        /* Hardcoding click behavior also isn't optimal I guess */
      });
    rect.append("title").text(date+"\n"+time.seconds_to_duration(usage_time));
  }

  return container;
}

module.exports = {
  "create": create,
  "update": update,
  "set_status": set_status,
};
