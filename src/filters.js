'use strict';

import Vue from 'vue';

import moment from 'moment';

Vue.filter('friendlytime', function (timestamp) {
  let m = moment.parseZone(timestamp);
  let sinceNow = moment.duration(m.diff(moment()));
  if(-sinceNow.asSeconds() <= 60*60*24) {
    return sinceNow.humanize(true);
  }
  return timestamp;
});

Vue.filter('friendlyduration', function (seconds) {
  let d = moment.duration(Number.parseFloat(seconds)*1000);
  let s = [Math.floor(d.asHours()) + "h", d.minutes() + "m", d.seconds() + "s"].join(" ");
  s = s.replace(/(0h| 0[ms])/g, "");
  s = s.replace(/ +/g, " ").trim();
  if(s === "") {
    s = "<1 s";
  }
  return s;
});
