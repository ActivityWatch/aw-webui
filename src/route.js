import Vue from 'vue';
import VueRouter from 'vue-router';

const Home = () => import('./views/Home.vue');

// Activity views for desktop
const Activity = () => import('./views/activity/Activity.vue');
const ActivitySummary = () => import('./views/activity/ActivitySummary.vue');
const ActivityWindow = () => import('./views/activity/ActivityWindow.vue');
const ActivityBrowser = () => import('./views/activity/ActivityBrowser.vue');
const ActivityEditor = () => import('./views/activity/ActivityEditor.vue');

const Buckets = () => import('./views/Buckets.vue');
const Bucket = () => import('./views/Bucket.vue');
const QueryExplorer = () => import('./views/QueryExplorer.vue');
const Timeline = () => import('./views/Timeline.vue');
const Settings = () => import('./views/settings/Settings.vue');
const Stopwatch = () => import('./views/Stopwatch.vue');
const Dev = () => import('./views/Dev.vue');

Vue.use(VueRouter);

const router = new VueRouter({
  routes: [
    { path: '/', component: Home },
    {
      path: '/activity/:host/:periodLength?/:date?',
      component: Activity,
      props: true,
      children: [
        {
          path: 'summary',
          meta: { subview: 'summary' },
          name: 'activity-summary',
          component: ActivitySummary,
          props: true,
        },
        {
          path: 'window',
          meta: { subview: 'window' },
          name: 'activity-window',
          component: ActivityWindow,
          props: true,
        },
        {
          path: 'browser',
          meta: { subview: 'browser' },
          name: 'activity-browser',
          component: ActivityBrowser,
        },
        {
          path: 'editor',
          meta: { subview: 'editor' },
          name: 'activity-editor',
          component: ActivityEditor,
        },
        // Unspecified should redirect to summary view is the summary view
        // (needs to be last since otherwise it'll always match first)
        {
          path: '',
          redirect: 'summary',
        },
      ],
    },
    { path: '/buckets', component: Buckets },
    { path: '/buckets/:id', component: Bucket, props: true },
    { path: '/timeline', component: Timeline },
    { path: '/query', component: QueryExplorer },
    { path: '/settings', component: Settings },
    { path: '/stopwatch', component: Stopwatch },
    { path: '/dev', component: Dev },
  ],
});

export default router;
