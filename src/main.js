import '@babel/polyfill';

import Vue from 'vue';

// Load the Bootstrap CSS
import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
Vue.use(BootstrapVue);

import { Datetime } from 'vue-datetime';
import 'vue-datetime/dist/vue-datetime.css';
Vue.component('datetime', Datetime);

// Setup default settings
if (!('startOfDay' in localStorage)) {
  localStorage.startOfDay = '04:00';
}

// Load the Varela Round font
import 'typeface-varela-round';

import './style/style.scss';

// Loads all the filters
import './util/filters.js';

// Create an instance of AWClient as this.$aw
import awclient from './util/awclient.js';
Vue.prototype.$aw = awclient;

// i18n
import VueI18n from 'vue-i18n';
import _default from './locale/default';
Vue.use(VueI18n);

export const i18n = new VueI18n({
  locale: 'default',
  fallbackLocale: 'default',
  messages: {
    default: _default,
  },
});

const loadedLanguages = ['default'];

function setI18nLanguage(lang) {
  i18n.locale = lang;
  document.querySelector('html').setAttribute('lang', lang);
  return lang;
}

export function loadLanguageAsync(lang) {
  // If the language was already loaded
  if (loadedLanguages.includes(lang)) {
    if (i18n.locale === lang) {
      return Promise.resolve(setI18nLanguage(lang));
    }
  }

  // If the language hasn't been loaded yet
  return awclient.getTranslations(lang)
    .then(response => {
      const messages = response?.content?.reduce((cur, message) => {
        const key = message?.fields?.find(field => field.identifier === 'emie_pjub_slug');
        const en = message?.fields?.find(field => field.identifier === 'emie_ftsv_text');
        const fr = message?.fields?.find(field => field.identifier === 'emie_xnep_text');
        if (key && en && fr) {
          cur.en[key.value] = en.value;
          cur.fr[key.value] = fr.value;
        }

        return cur;
      },
      { en: {}, fr: {} });

      loadedLanguages.push(lang);
      i18n.setLocaleMessage(lang, messages[lang]);
      setI18nLanguage(lang);
    });
}

// ApexCharts
import VueApexCharts from 'vue-apexcharts';
Vue.use(VueApexCharts);
Vue.component('apexchart', VueApexCharts);

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Sets up the vuex store
import store from './store';

// Register Font Awesome icon component
Vue.component('icon', () => import('vue-awesome/components/Icon'));

// General components
Vue.component('error-boundary', () => import('./components/ErrorBoundary.vue'));
Vue.component('input-timeinterval', () => import('./components/InputTimeInterval.vue'));
Vue.component('aw-header', () => import('./components/Header.vue'));
Vue.component('aw-devonly', () => import('./components/DevOnly.vue'));
Vue.component('aw-selectable-vis', () => import('./components/SelectableVisualization.vue'));
Vue.component('aw-selectable-eventview', () => import('./components/SelectableEventView.vue'));
// Vue.component('new-release-notification', () => import('./components/NewReleaseNotification.vue'));
// Vue.component('user-satisfaction-poll', () => import('./components/UserSatisfactionPoll.vue'));

// Visualization components
Vue.component('aw-summary', () => import('./visualizations/Summary.vue'));
Vue.component('aw-periodusage', () => import('./visualizations/PeriodUsage.vue'));
Vue.component('aw-eventlist', () => import('./visualizations/EventList.vue'));
Vue.component('aw-sunburst-categories', () => import('./visualizations/SunburstCategories.vue'));
Vue.component('aw-sunburst-clock', () => import('./visualizations/SunburstClock.vue'));
Vue.component('aw-timeline-inspect', () => import('./visualizations/TimelineInspect.vue'));
Vue.component('aw-timeline', () => import('./visualizations/TimelineSimple.vue'));
Vue.component('vis-timeline', () => import('./visualizations/VisTimeline.vue'));
Vue.component('aw-categorytree', () => import('./visualizations/CategoryTree.vue'));
Vue.component('aw-timeline-barchart', () => import('./visualizations/TimelineBarChart.vue'));
Vue.component('aw-calendar', () => import('./visualizations/Calendar.vue'));
Vue.component('aw-heatmap', () => import('./visualizations/Heatmap.vue'));

// A mixin to make async method errors propagate
Vue.mixin(require('~/mixins/asyncErrorCaptured.js'));

// Set the PRODUCTION constant
Vue.prototype.PRODUCTION = PRODUCTION;

// Setup Vue app
import App from './App';
new Vue({
  el: '#app',
  i18n,
  router: router,
  render: h => h(App),
  store,
});
