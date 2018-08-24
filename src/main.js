import Vue from 'vue';

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
Vue.use(BootstrapVue);

// Load the Varela Round font
import 'typeface-varela-round';

// Loads all the resources (using vue-resource)
import './awclient.js';

// Loads all the filters
import './filters.js';

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Register Font Awesome icon component
import Icon from 'vue-awesome/components/Icon'
Vue.component('icon', Icon)

// Our custom components
import Summary from './visualizations/Summary.vue';
Vue.component('aw-summary', Summary);

import PeriodUsage from './visualizations/PeriodUsage.vue';
Vue.component('aw-periodusage', PeriodUsage);

import EventList from './visualizations/EventList.vue';
Vue.component('aw-eventlist', EventList);

import Sunburst from './visualizations/Sunburst.vue';
Vue.component('aw-sunburst', Sunburst);

import TimelineInspect from './visualizations/TimelineInspect.vue';
Vue.component('aw-timeline-inspect', TimelineInspect);

import Timeline from './visualizations/TimelineSimple.vue';
Vue.component('aw-timeline', Timeline);

import VisTimeline from './visualizations/VisTimeline.vue';
Vue.component('vis-timeline', VisTimeline);

//import GCTimeline from './visualizations/GCTimeline.vue';
//Vue.component('GCTimeline', GCTimeline);

// Setup Vue app
import App from './App';
new Vue({
  el: '#app',
  router: router,
  render: h => h(App)
});
