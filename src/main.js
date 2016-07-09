import Vue from 'vue'
import App from './App'
import VueRouter from 'vue-router';

import Home from './Home.vue';
import Buckets from './Buckets.vue';
import Settings from './Settings.vue';

Vue.use(VueRouter);

var router = new VueRouter();

router.map({
  '/': {
    component: Home
  },
  '/buckets': {
    component: Buckets
  },
  '/settings': {
    component: Settings
  }
});

router.start(App, "#app");
