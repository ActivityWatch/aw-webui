import Vue from 'vue';
import App from './App';
import VueRouter from 'vue-router';

import Home from './Home.vue';
import Buckets from './Buckets.vue';
import Bucket from './Bucket.vue';
import Settings from './Settings.vue';

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
  '/settings': {
    component: Settings
  }
});

router.start(App, "#app");

