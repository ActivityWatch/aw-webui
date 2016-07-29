import Vue from 'vue';
import App from './App';
import VueRouter from 'vue-router';

import Home from './Home.vue';
import Buckets from './Buckets.vue';
import Bucket from './Bucket.vue';
import User from './User.vue';
import Settings from './Settings.vue';

import './filters.js';

Vue.use(require('vue-resource'));

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

