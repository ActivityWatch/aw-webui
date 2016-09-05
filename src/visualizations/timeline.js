"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

// TODO: Always give the same appname the same color

function _windowLabelsAsProps(events) {
  return _.map(events, function(event) {
    _.each(event.label, function(label) {
      if(label.startsWith("appname:")) {
        event.appname = label;
      } else if(label.startsWith("title:")) {
        event.title = label;
      }
    });
    return event;
  });
}

function _mergeWithSameAppname(events) {
  return _.reduce(events, function(result, value, key) {
    if(key === 0) {
      result.push(value);
    } else {
      let last_event = result[result.length-1];
      console.log(last_event);
      if(last_event.appname === value.appname) {
        last_event.duration[0].value += value.duration[0].value;
      } else {
        result.push(value);
      }
    }
    return result;
  }, []);
}

function renderTimeline(el, events) {
  // Clear element
  el.innerHTML = "";

  let svg = d3.select(el).append("svg");
  let width = 400;
  svg.attr("width", width);

  events = _windowLabelsAsProps(events);
  events = _mergeWithSameAppname(events);

  let g = svg.append("g");
  g.attr("transform", "translate(" + 50 + ", 0)");

  let secondsPerPixel = 1;

  var color = Color();
  color.hsv(0, 255, 150);

  var curr_y = 0;
  _.each(events, function(e, i) {
    console.log(i, e);

    let barHeight = e.duration[0].value / secondsPerPixel;
    let textSize = 0;
    if(barHeight > 17) {
      textSize = 15;
    } else if(barHeight > 12) {
      textSize = 10;
    } else if(barHeight > 8) {
      textSize = 6;
    }

    let eg = g.append("g");

    eg.append("rect")
     .attr("x", 0)
     .attr("y", curr_y)
     .attr("width", 400)
     .attr("height", barHeight)
     .style("fill", color.rgbString());
    eg.append("text")
     .attr("x", 5)
     .attr("y", curr_y + (barHeight / 2) + (textSize / 2))
     .text(e.appname)
     .attr("font-family", "sans-serif")
     .attr("font-size", textSize + "px")
     .attr("fill", "black");
    curr_y += barHeight;
    color.hue(color.hue() + 90);
  });

  // Set so that SVG resizes depending on timeline length
  svg.attr("height", curr_y);

  return svg;
}

module.exports = renderTimeline;

