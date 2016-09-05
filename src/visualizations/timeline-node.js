"use strict";

const renderTimeline = require("./timeline");

const jsdom = require("jsdom");

const events = [
  {
    label: ["appname:test"],
    duration: [{value: 120}],
  },
  {
    "label": ["appname:test"],
    duration: [{value: 120}],
  },
  {
    "label": ["appname:test2"],
    duration: [{value: 120}],
  }
];

var document = jsdom.jsdom();
renderTimeline(document.body, events);
console.log(document.body.innerHTML);
