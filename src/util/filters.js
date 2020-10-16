'use strict';

import _ from 'lodash';
import Vue from 'vue';
import { seconds_to_duration, friendlydate } from './time.js';

import moment from 'moment';

Vue.filter('shortdate', function (timestamp) {
  return moment(timestamp).format('YYYY-MM-DD');
});

Vue.filter('shorttime', function (timestamp) {
  return moment(timestamp).format('HH:mm');
});

Vue.filter('friendlytime', function (timestamp) {
  return friendlydate(timestamp);
});

Vue.filter('iso8601', function (timestamp) {
  return moment.parseZone(timestamp).format();
});

Vue.filter('friendlyduration', function (seconds) {
  return seconds_to_duration(seconds);
});

// Apparently this is how we should do filters now
// https://github.com/vuejs/vue/issues/2756#issuecomment-215508316
Vue.prototype.filters = {
  //  filterBy: ...,
  orderBy: _.orderBy,
};
