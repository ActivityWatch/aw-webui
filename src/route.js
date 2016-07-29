import Vue from 'vue';
import App from './App';
import VueRouter from 'vue-router';

import Home from './views/Home.vue';
import Buckets from './views/Buckets.vue';
import Bucket from './views/Bucket.vue';
import User from './views/User.vue';
import Settings from './views/Settings.vue';

Vue.use(VueRouter);
var router = new VueRouter();

router.map({
  '/': {
    component: Home
  },
  '/buckets': {
    component: Buckets
  },
  '/buckets/:id': {
    component: Bucket
  },
  '/u/:username': {
    component: User
  },
  '/settings': {
    component: Settings
  }
});

router.start(App, "#app");

