const jsdom = require("jsdom");
const { JSDOM } = jsdom;

import renderTimeline from "./src/visualizations/timeline.js";

var dom = new JSDOM("")

var root_el = dom.window.document.createElement("div");

var example_events = [
    {"timestamp": "<timestamp>", "duration": 10, "data": {"title": "lololtitle", "app": "lololapp"}},
    {"timestamp": "<timestamp>", "duration": 10, "data": {"title": "lololtitle", "app": "lololapp"}}
]

var total_duration = 20;

renderTimeline(root_el, example_events, total_duration)

