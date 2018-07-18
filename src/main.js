import Vue from 'vue';

import Vuetify from 'vuetify';
Vue.use(Vuetify);

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
Vue.use(BootstrapVue);

// Load the Varela Round font
require('typeface-varela-round');

// Loads all the resources (using vue-resource)
import './awclient.js';

// Loads all the filters
import './filters.js';

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Register Font Awesome icon component
import Icon from 'vue-awesome/components/Icon'
Vue.component('icon', Icon)

// Setup Vue app
import App from './App';
new Vue({
  el: '#app',
  router: router,
  render: h => h(App)
});
