const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const timeline = require("./src/visualizations/timeline.js");

var dom = new JSDOM("")
global.window = dom.window;
global.document = dom.window.document;


var root_el = dom.window.document.createElement("div");

var example_events = [
    {"timestamp": "<timestamp>", "duration": 10, "data": {"title": "lololtitle", "app": "lololapp"}},
    {"timestamp": "<timestamp>", "duration": 10, "data": {"title": "lololtitle", "app": "lololapp"}}
]

var total_duration = 20;

timeline.create(root_el)
timeline.update(root_el, example_events, total_duration)

