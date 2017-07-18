import Vue from 'vue';

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
Vue.use(BootstrapVue);

// Loads all the resources (using vue-resource)
import './resources.js';

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
