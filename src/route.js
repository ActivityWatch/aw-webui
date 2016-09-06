import Vue from 'vue';
import App from './App';
import VueRouter from 'vue-router';

import Home from './views/Home.vue';
import Activity from './views/Activity.vue';
import Buckets from './views/Buckets.vue';
import Bucket from './views/Bucket.vue';
import Log from './views/Log.vue';
import User from './views/User.vue';
import Settings from './views/Settings.vue';

Vue.use(VueRouter);
var router = new VueRouter();

router.map({
  '/': {
    component: Home
  },
  '/activity': {
    component: Activity
  },
  '/activity/:date': {
    component: Activity
  },
  '/buckets': {
    component: Buckets
  },
  '/buckets/:id': {
    component: Bucket
  },
  '/log': {
    component: Log
  },
  '/u/:username': {
    component: User
  },
  '/settings': {
    component: Settings
  }
});

router.start(App, "#app");

