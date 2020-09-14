import '@babel/polyfill';

import Vue from 'vue';

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
Vue.use(BootstrapVue);

import { Datetime } from 'vue-datetime';
import 'vue-datetime/dist/vue-datetime.css';
Vue.component('datetime', Datetime);

// Setup default settings
if (!('startOfDay' in localStorage)) {
  localStorage.startOfDay = '04:00';
}

// Load the Varela Round font
import 'typeface-varela-round';

// Loads all the filters
import './util/filters.js';

// Create an instance of AWClient as this.$aw
import awclient from './util/awclient.js';
Vue.prototype.$aw = awclient;

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Sets up the vuex store
import store from './store';

// Register Font Awesome icon component
Vue.component('icon', () => import('vue-awesome/components/Icon'));

// General components
Vue.component('error-boundary', () => import('./components/ErrorBoundary.vue'));
Vue.component('input-timeinterval', () => import('./components/InputTimeInterval.vue'));
Vue.component('aw-header', () => import('./components/Header.vue'));
Vue.component('aw-devonly', () => import('./components/DevOnly.vue'));
Vue.component('aw-selectable-vis', () => import('./components/SelectableVisualization.vue'));
Vue.component('new-release-notification', () => import('./components/NewReleaseNotification.vue'));

// Visualization components
Vue.component('aw-summary', () => import('./visualizations/Summary.vue'));
Vue.component('aw-periodusage', () => import('./visualizations/PeriodUsage.vue'));
Vue.component('aw-eventlist', () => import('./visualizations/EventList.vue'));
Vue.component('aw-sunburst-categories', () => import('./visualizations/SunburstCategories.vue'));
Vue.component('aw-sunburst-clock', () => import('./visualizations/SunburstClock.vue'));
Vue.component('aw-timeline-inspect', () => import('./visualizations/TimelineInspect.vue'));
Vue.component('aw-timeline', () => import('./visualizations/TimelineSimple.vue'));
Vue.component('vis-timeline', () => import('./visualizations/VisTimeline.vue'));
Vue.component('aw-categorytree', () => import('./visualizations/CategoryTree.vue'));
Vue.component('aw-timeline-barchart', () => import('./visualizations/TimelineBarChart.vue'));
Vue.component('aw-calendar', () => import('./visualizations/Calendar.vue'));

// A mixin to make async method errors propagate
Vue.mixin(require('~/mixins/asyncErrorCaptured.js'));

// Set the PRODUCTION constant
Vue.prototype.PRODUCTION = PRODUCTION;

// Setup Vue app
import App from './App';
new Vue({
  el: '#app',
  router: router,
  render: h => h(App),
  store,
});
