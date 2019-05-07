import Vue from 'vue';
import VueRouter from 'vue-router';

const Home = () => import('./views/Home.vue');
const Activity = () => import('./views/ActivityDaily.vue');
const ActivitySummary = () => import('./views/ActivitySummary.vue');
const ActivityAndroid = () => import('./views/ActivityAndroid.vue');
const Buckets = () => import('./views/Buckets.vue');
const Bucket = () => import('./views/Bucket.vue');
const QueryExplorer = () => import('./views/QueryExplorer.vue');
const Timeline = () => import('./views/Timeline.vue');
const Log = () => import('./views/Log.vue');
const Settings = () => import('./views/Settings.vue');
const Stopwatch = () => import('./views/Stopwatch.vue');

Vue.use(VueRouter);

var router = new VueRouter({
  routes: [
    { path: '/',                        component: Home },
    { path: '/activity/daily/:host',    component: Activity},
    { path: '/activity/daily/:host/:date',      component: Activity },
    { path: '/activity/summary/:host',           component: ActivitySummary },
    { path: '/activity/summary/:host/:date',     component: ActivitySummary },
    { path: '/activity/android/:host',          component: ActivityAndroid },
    { path: '/activity/android/:host/:date',    component: ActivityAndroid },
    { path: '/buckets',                 component: Buckets },
    { path: '/buckets/:id',             component: Bucket },
    { path: '/timeline',                component: Timeline },
    { path: '/query',                   component: QueryExplorer },
    { path: '/log',                     component: Log },
    { path: '/settings',                component: Settings },
    { path: '/stopwatch',               component: Stopwatch },
  ]
});

export default router;
