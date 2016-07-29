'use strict';

import Vue from 'vue';

import moment from 'moment';

Vue.filter('friendlytime', function (timestamp) {
  let m = moment.parseZone(timestamp);
  console.log(m);
  let sinceNow = moment.duration(m.diff(moment()));
  if(-sinceNow.asSeconds() <= 60*60*24) {
    return sinceNow.humanize(true);
  }
  return timestamp;
});
