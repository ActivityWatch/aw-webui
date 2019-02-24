import Vue from 'vue';
import VueRouter from 'vue-router';

import Home from './views/Home.vue';
import Activity from './views/Activity.vue';
import ActivityAndroid from './views/ActivityAndroid.vue';
import Buckets from './views/Buckets.vue';
import Bucket from './views/Bucket.vue';
import QueryExplorer from './views/QueryExplorer.vue';
import Timeline from './views/Timeline.vue';
import Log from './views/Log.vue';

Vue.use(VueRouter);

var router = new VueRouter({
  routes: [
    { path: '/',                        component: Home },
    { path: '/activity/:host',          component: Activity },
    { path: '/activity/:host/:date',    component: Activity },
    { path: '/activity-android/:host',          component: ActivityAndroid },
    { path: '/activity-android/:host/:date',    component: ActivityAndroid },
    { path: '/buckets',                 component: Buckets },
    { path: '/buckets/:id',             component: Bucket },
    { path: '/timeline',                component: Timeline },
    { path: '/query',                   component: QueryExplorer },
    { path: '/log',                     component: Log },
  ]
});

export default router;
