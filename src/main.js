import Vue from 'vue';

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';

// Register Font Awesome icon component
import Icon from 'vue-awesome/components/Icon.vue';

// Load the Varela Round font
import '../static/css/varela-round.css';

// Loads all the resources (using vue-resource)
import './awclient';

// Loads all the filters
import './filters';

// Sets up the routing and the base app (using vue-router)
import router from './route';

// Import Vue app
import App from './App.vue';

Vue.use(BootstrapVue);
Vue.component('icon', Icon);

new Vue({ // eslint-disable-line no-new
  router,
  el: '#app',
  render: h => h(App),
});
