import Vue from 'vue';

import Vuetify from 'vuetify';
import 'vuetify/dist/vuetify.min.css';
Vue.use(Vuetify);

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
//import 'bootstrap/dist/css/bootstrap.css';
//import 'bootstrap-vue/dist/bootstrap-vue.css';
Vue.use(BootstrapVue);

// Load the Varela Round font
import 'typeface-varela-round';

// Material design icons
import 'material-design-icons-iconfont/dist/material-design-icons.css';

// Loads all the resources (using vue-resource)
import './awclient.js';

// Loads all the filters
import './filters.js';

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Register Font Awesome icon component
import Icon from 'vue-awesome/components/Icon'
Vue.component('icon', Icon)

// Custom components
import Summary from './visualizations/Summary.vue';
import Sunburst from './visualizations/Sunburst.vue';
import PeriodUsage from './visualizations/PeriodUsage.vue';
import Timeline from './visualizations/TimelineInspect.vue';
Vue.component('aw-summary', Summary)
Vue.component('aw-sunburst', Sunburst)
Vue.component('aw-periodusage', PeriodUsage)
Vue.component('aw-timeline', Timeline)

// Setup Vue app
import App from './App';
new Vue({
  el: '#app',
  router: router,
  render: h => h(App)
});
