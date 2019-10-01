import Vue from 'vue';
import VueRouter from 'vue-router';

const Home = () => import('./views/Home.vue');

// Daily activity views for desktop
const ActivityDaily = () => import('./views/ActivityDaily.vue');
const ActivityDailySummary = () => import('./views/ActivityDailySummary.vue');
const ActivityDailyWindow = () => import('./views/ActivityDailyWindow.vue');
const ActivityDailyBrowser = () => import('./views/ActivityDailyBrowser.vue');
const ActivityDailyEditor = () => import('./views/ActivityDailyEditor.vue');

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
    { path: '/', component: Home },
    {
      path: '/activity/daily/:host/:date?',
      component: ActivityDaily,
      name: 'activity-daily',
      props: true,
      children: [
        {
          path: 'summary',
          name: 'activity-daily-summary',
          component: ActivityDailySummary,
          props: true,
        },
        {
          path: 'window',
          name: 'activity-daily-window',
          component: ActivityDailyWindow,
          props: true,
        },
        {
          path: 'browser',
          name: 'activity-daily-browser',
          component: ActivityDailyBrowser,
          props: true,
        },
        {
          path: 'editor',
          name: 'activity-daily-editor',
          component: ActivityDailyEditor,
          props: true,
        },
      ],
    },
    { path: '/activity/summary/:host/:date?', component: ActivitySummary },
    { path: '/activity/android/:host/:date?', component: ActivityAndroid },
    { path: '/buckets', component: Buckets },
    { path: '/buckets/:id', component: Bucket },
    { path: '/timeline', component: Timeline },
    { path: '/query', component: QueryExplorer },
    { path: '/log', component: Log },
    { path: '/settings', component: Settings },
    { path: '/stopwatch', component: Stopwatch },
  ],
});

export default router;
