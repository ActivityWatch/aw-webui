'use strict';

import _ from 'lodash';
import Vue from 'vue';
import { seconds_to_duration, friendlydate } from './time';
import { periodReadable } from './timeperiod';

import moment from 'moment';

Vue.filter('iso8601', function (timestamp: moment.MomentInput) {
  return moment.parseZone(timestamp).format();
});

Vue.filter('shortdate', function (timestamp: moment.MomentInput) {
  return moment(timestamp).format('YYYY-MM-DD');
});

Vue.filter('shorttime', function (timestamp: moment.MomentInput) {
  return moment(timestamp).format('HH:mm');
});

Vue.filter('friendlytime', function (timestamp: moment.MomentInput) {
  return friendlydate(timestamp as string);
});

Vue.filter('friendlyduration', function (seconds: number) {
  return seconds_to_duration(seconds);
});

Vue.filter('friendlyperiod', function (timeperiod: Parameters<typeof periodReadable>[0]) {
  return periodReadable(timeperiod);
});

// Apparently this is how we should do filters now
// https://github.com/vuejs/vue/issues/2756#issuecomment-215508316
Vue.prototype.filters = {
  //  filterBy: ...,
  orderBy: _.orderBy,
};
