'use strict';

import _ from 'lodash';
import Vue from 'vue';

import moment from 'moment';

Vue.filter('friendlytime', function (timestamp) {
  let now = moment();
  let m = moment.parseZone(timestamp);
  let sinceNow = moment.duration(m.diff(now));
  if(-sinceNow.asSeconds() <= 60) {
    return `${Math.round(-sinceNow.asSeconds())}s ago`;
  } else if(-sinceNow.asSeconds() <= 60*60*24) {
    return sinceNow.humanize(true);
  }
  return sinceNow.humanize(true);
  //return timestamp;
});

Vue.filter('iso8601', function(timestamp) {
  return moment.parseZone(timestamp).format();
});

Vue.filter('friendlyduration', function (seconds) {
  if(seconds <= 0) {
    console.log(seconds)
    return "0s";
  }
  let d = moment.duration(Number.parseFloat(seconds)*1000);
  let s = [Math.floor(d.asHours()) + "h", d.minutes() + "m", d.seconds() + "s"].join(" ");
  s = s.replace(/(0h| 0[ms])/g, "");
  s = s.replace(/ +/g, " ").trim();
  if(s === "") {
    s = "<1s";
  }
  return s;
});

// Apparently this is how we should do filters now
// https://github.com/vuejs/vue/issues/2756#issuecomment-215508316
Vue.prototype.filters = {
//  filterBy: ...,
  orderBy: _.orderBy
}
