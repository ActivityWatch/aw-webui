import Vue from 'vue';
import Vuex from 'vuex';
import activity from './modules/activity';
import buckets from './modules/buckets';
import settings from './modules/settings';
//import createLogger from '../../../src/plugins/logger';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
  modules: {
    activity,
    buckets,
    settings,
  },
  strict: debug,
  //  plugins: debug ? [createLogger()] : [],
});
