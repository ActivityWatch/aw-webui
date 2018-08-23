import Vue from 'vue';

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
Vue.use(BootstrapVue);

import VueGoogleCharts from 'vue-google-charts'
Vue.use(VueGoogleCharts)

// Load the Varela Round font
import '../static/css/varela-round.css';

// Loads all the resources (using vue-resource)
import './awclient.js';

// Loads all the filters
import './filters.js';

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Register Font Awesome icon component
import Icon from 'vue-awesome/components/Icon'
Vue.component('icon', Icon)

import Timeline from './visualizations/TimelineSimple.vue';
import EventList from './visualizations/EventList.vue';
import GCTimeline from './visualizations/GCTimeline.vue';
Vue.component('aw-timeline', Timeline);
Vue.component('aw-eventlist', EventList);
Vue.component('GCTimeline', GCTimeline);
import VisTimeline from './visualizations/VisTimeline.vue';
Vue.component('VisTimeline', VisTimeline);

// Setup Vue app
import App from './App';
new Vue({
  el: '#app',
  router: router,
  render: h => h(App)
});
