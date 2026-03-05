import 'core-js/stable';
import 'regenerator-runtime/runtime';

import { createApp, defineAsyncComponent } from 'vue';

// Load the Bootstrap CSS
import { createBootstrap } from 'bootstrap-vue-next';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css';

// Load the Varela Round font
import 'typeface-varela-round';

// Load the main style
import './style/style.scss';

// Loads all the filters
import './util/filters.js';

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Sets up the pinia store
import pinia from './stores';

// NOTE: vue-datetime is Vue 2 only — removed (TODO: find Vue 3 alternative)
// NOTE: vue-awesome is Vue 2 only — removed (TODO: find Vue 3 alternative, e.g. @fortawesome/vue-fontawesome)

// Create an instance of AWClient as this.$aw
// NOTE: needs to be created before the Vue app is created,
//       since stores rely on it having been run.
import { createClient, getClient, configureClient } from './util/awclient';
createClient();

// Setup Vue app
import App from './App.vue';
import asyncErrorCapturedMixin from './mixins/asyncErrorCaptured.js';

const app = createApp(App);

// Register plugins
app.use(createBootstrap());
app.use(router);
app.use(pinia);

// Set global properties (replaces Vue.prototype.X = Y)
app.config.globalProperties.PRODUCTION = PRODUCTION;
app.config.globalProperties.COMMIT_HASH = COMMIT_HASH;
app.config.globalProperties.$isAndroid = process.env.VUE_APP_ON_ANDROID;

// Register global mixin
app.mixin(asyncErrorCapturedMixin);

// Register global async components (replaces Vue.component with lazy imports)
// NOTE: icon component (vue-awesome) removed — Vue 2 only, register replacement here when available
app.component(
  'icon',
  defineAsyncComponent(() => import('./components/IconPlaceholder.vue'))
);
app.component(
  'error-boundary',
  defineAsyncComponent(() => import('./components/ErrorBoundary.vue'))
);
app.component(
  'input-timeinterval',
  defineAsyncComponent(() => import('./components/InputTimeInterval.vue'))
);
app.component(
  'aw-header',
  defineAsyncComponent(() => import('./components/Header.vue'))
);
app.component(
  'aw-footer',
  defineAsyncComponent(() => import('./components/Footer.vue'))
);
app.component(
  'aw-devonly',
  defineAsyncComponent(() => import('./components/DevOnly.vue'))
);
app.component(
  'aw-selectable-vis',
  defineAsyncComponent(() => import('./components/SelectableVisualization.vue'))
);
app.component(
  'aw-selectable-eventview',
  defineAsyncComponent(() => import('./components/SelectableEventView.vue'))
);
app.component(
  'new-release-notification',
  defineAsyncComponent(() => import('./components/NewReleaseNotification.vue'))
);
app.component(
  'user-satisfaction-poll',
  defineAsyncComponent(() => import('./components/UserSatisfactionPoll.vue'))
);
app.component(
  'aw-query-options',
  defineAsyncComponent(() => import('./components/QueryOptions.vue'))
);
app.component(
  'aw-select-categories',
  defineAsyncComponent(() => import('./components/SelectCategories.vue'))
);
app.component(
  'aw-select-categories-or-pattern',
  defineAsyncComponent(() => import('./components/SelectCategoriesOrPattern.vue'))
);

// Visualization components
app.component(
  'aw-summary',
  defineAsyncComponent(() => import('./visualizations/Summary.vue'))
);
app.component(
  'aw-periodusage',
  defineAsyncComponent(() => import('./visualizations/PeriodUsage.vue'))
);
app.component(
  'aw-eventlist',
  defineAsyncComponent(() => import('./visualizations/EventList.vue'))
);
app.component(
  'aw-sunburst-categories',
  defineAsyncComponent(() => import('./visualizations/SunburstCategories.vue'))
);
app.component(
  'aw-top-bucket-data',
  defineAsyncComponent(() => import('./visualizations/TopBucketData.vue'))
);
app.component(
  'aw-sunburst-clock',
  defineAsyncComponent(() => import('./visualizations/SunburstClock.vue'))
);
app.component(
  'aw-timeline-inspect',
  defineAsyncComponent(() => import('./visualizations/TimelineInspect.vue'))
);
app.component(
  'aw-timeline',
  defineAsyncComponent(() => import('./visualizations/TimelineSimple.vue'))
);
app.component(
  'vis-timeline',
  defineAsyncComponent(() => import('./visualizations/VisTimeline.vue'))
);
app.component(
  'aw-categorytree',
  defineAsyncComponent(() => import('./visualizations/CategoryTree.vue'))
);
app.component(
  'aw-timeline-barchart',
  defineAsyncComponent(() => import('./visualizations/TimelineBarChart.vue'))
);
app.component(
  'aw-calendar',
  defineAsyncComponent(() => import('./visualizations/Calendar.vue'))
);
app.component(
  'aw-custom-vis',
  defineAsyncComponent(() => import('./visualizations/CustomVisualization.vue'))
);
app.component(
  'aw-score',
  defineAsyncComponent(() => import('./visualizations/Score.vue'))
);

app.mount('#app');

// Set the $aw global property
app.config.globalProperties.$aw = getClient();

// Must be run after vue init since it relies on the settings store
configureClient();
