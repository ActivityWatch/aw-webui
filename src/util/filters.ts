'use strict';

// NOTE: Vue 3 removed global filters (Vue.filter is gone).
// These functions are exported for direct use in components via computed props or methods.
// Components using {{ value | filterName }} need to be updated to {{ filterName(value) }}.

import _ from 'lodash';
import { seconds_to_duration, friendlydate } from './time';
import { periodReadable } from './timeperiod';

import moment from 'moment';

export function iso8601(timestamp: moment.MomentInput) {
  return moment.parseZone(timestamp).format();
}

export function shortdate(timestamp: moment.MomentInput) {
  return moment(timestamp).format('YYYY-MM-DD');
}

export function shorttime(timestamp: moment.MomentInput) {
  return moment(timestamp).format('HH:mm');
}

export function friendlytime(timestamp: moment.MomentInput) {
  return friendlydate(timestamp as string);
}

export function friendlyduration(seconds: number) {
  return seconds_to_duration(seconds);
}

export function friendlyperiod(timeperiod: Parameters<typeof periodReadable>[0]) {
  return periodReadable(timeperiod);
}

export const orderBy = _.orderBy;
