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

var router = new VueRouter({
  routes: [
    { path: '/',                        component: Home },
    { path: '/activity/:host',          component: Activity },
    { path: '/activity/:host/:date',    component: Activity },
    { path: '/buckets',                 component: Buckets },
    { path: '/buckets/:id',             component: Bucket },
    { path: '/log',                     component: Log },
    { path: '/u/:username',             component: User },
    { path: '/settings',                component: Settings },
  ]
});

// TODO: Maybe export the router object instead and do the
// initialization in main.js or something.
new Vue({
  el: '#app',
  router: router,
  render: h => h('router-view')
})
