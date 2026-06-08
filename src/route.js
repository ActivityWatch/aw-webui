import Vue from 'vue';
import VueRouter from 'vue-router';

const Home = () => import('./views/Home.vue');

// Activity views for desktop
const Activity = () => import('./views/activity/Activity.vue');
const ActivityView = () => import('./views/activity/ActivityView.vue');

const Buckets = () => import('./views/Buckets.vue');
const Bucket = () => import('./views/Bucket.vue');
const QueryExplorer = () => import('./views/QueryExplorer.vue');
const Timeline = () => import('./views/Timeline.vue');
const Trends = () => import('./views/Trends.vue');
const Settings = () => import('./views/settings/Settings.vue');
// CategoryBuilder is no longer a top-level route — it's embedded inside
// CategorizationSettings. The /settings/category-builder path is now a
// redirect, so no direct reference here. Keeping the import out avoids
// pulling a second copy into a separate chunk.
const Stopwatch = () => import('./views/Stopwatch.vue');
const WorkReport = () => import('./views/WorkReport.vue');
const Alerts = () => import('./views/Alerts.vue');
const Search = () => import('./views/Search.vue');
const Report = () => import('./views/Report.vue');
const TimespiralView = () => import('./views/TimespiralView.vue');
const Dev = () => import('./views/Dev.vue');
const Graph = () => import('./views/Graph.vue');
const NotFound = () => import('./views/NotFound.vue');

Vue.use(VueRouter);

const router = new VueRouter({
  routes: [
    {
      path: '/',
      redirect: _to => {
        return localStorage.landingpage || '/home';
      },
    },
    { path: '/home', component: Home },
    {
      path: '/activity/:host/:periodLength?/:date?',
      component: Activity,
      props: true,
      children: [
        {
          path: 'view/:view_id?',
          meta: { subview: 'view' },
          name: 'activity-view',
          component: ActivityView,
          props: true,
        },
        // Unspecified should redirect to summary view is the summary view
        // (needs to be last since otherwise it'll always match first)
        {
          path: '',
          redirect: 'view/',
        },
      ],
    },
    { path: '/buckets', component: Buckets },
    { path: '/buckets/:id', component: Bucket, props: true },
    { path: '/timeline', component: Timeline, meta: { fullContainer: true } },
    { path: '/trends', component: Trends, meta: { fullContainer: true } },
    { path: '/trends/:host', component: Trends, meta: { fullContainer: true } },
    { path: '/report', component: Report },
    { path: '/query', component: QueryExplorer },
    { path: '/alerts', component: Alerts },
    { path: '/timespiral', component: TimespiralView },
    { path: '/settings', component: Settings },
    // Category Builder now lives embedded inside the Categorization
    // settings panel; keep the old standalone route as a redirect so
    // external links / bookmarks still land somewhere useful.
    { path: '/settings/category-builder', redirect: '/settings/categorization' },
    // :group lets the active settings panel survive reloads / be linkable.
    // The matcher excludes 'category-builder' so the more specific route above
    // wins; new groups added in Settings.vue should also be added here.
    {
      path: '/settings/:group(general|appearance|categorization|privacy|developer)',
      component: Settings,
      props: true,
    },
    { path: '/stopwatch', component: Stopwatch },
    { path: '/work-report', component: WorkReport },
    { path: '/search', component: Search },
    { path: '/graph', component: Graph },
    { path: '/dev', component: Dev },
    // NOTE: Will break with Vue 3: https://stackoverflow.com/questions/40193634/vue-router-redirect-on-page-not-found-404/64186073#64186073
    {
      path: '*',
      component: NotFound,
    },
  ],
});

export default router;
