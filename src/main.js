import 'core-js/stable';
import 'regenerator-runtime/runtime';

import Vue from 'vue';

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
Vue.use(BootstrapVue);

import { Datetime } from 'vue-datetime';
import 'vue-datetime/dist/vue-datetime.css';
Vue.component('datetime', Datetime);

// Load the Varela Round font
import 'typeface-varela-round';

import './style/style.scss';

// Loads all the filters
import './util/filters.js';

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Sets up the pinia store
import pinia from './stores';

// Register Font Awesome icon component
Vue.component('icon', () => import('vue-awesome/components/Icon'));

// General components
Vue.component('error-boundary', () => import('./components/ErrorBoundary.vue'));
Vue.component('input-timeinterval', () => import('./components/InputTimeInterval.vue'));
Vue.component('aw-header', () => import('./components/Header.vue'));
Vue.component('aw-footer', () => import('./components/Footer.vue'));
Vue.component('aw-devonly', () => import('./components/DevOnly.vue'));
Vue.component('aw-selectable-vis', () => import('./components/SelectableVisualization.vue'));
Vue.component('aw-selectable-eventview', () => import('./components/SelectableEventView.vue'));
Vue.component('new-release-notification', () => import('./components/NewReleaseNotification.vue'));
Vue.component('user-satisfaction-poll', () => import('./components/UserSatisfactionPoll.vue'));
Vue.component('aw-query-options', () => import('./components/QueryOptions.vue'));
Vue.component('aw-select-categories', () => import('./components/SelectCategories.vue'));
Vue.component('aw-select-categories-or-pattern', () =>
  import('./components/SelectCategoriesOrPattern.vue')
);

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
Vue.component('aw-custom-vis', () => import('./visualizations/CustomVisualization.vue'));

// A mixin to make async method errors propagate
Vue.mixin(require('~/mixins/asyncErrorCaptured.js'));

// Set the PRODUCTION constant
// FIXME: Thould follow Vue convention and start with a $.
Vue.prototype.PRODUCTION = PRODUCTION;
Vue.prototype.COMMIT_HASH = COMMIT_HASH;

// Set the $isAndroid constant
Vue.prototype.$isAndroid = process.env.VUE_APP_ON_ANDROID;

// Setup Vue app
import App from './App';
new Vue({
  el: '#app',
  router: router,
  render: h => h(App),
  pinia,
});

// Create an instance of AWClient as this.$aw
import { createClient, getClient } from './util/awclient';

createClient();
Vue.prototype.$aw = getClient();
