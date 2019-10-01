import Vue from 'vue';
import Vuex from 'vuex';
import activity_daily from './modules/activity_daily';
//import createLogger from '../../../src/plugins/logger';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
  modules: {
    activity_daily,
  },
  strict: debug,
  //  plugins: debug ? [createLogger()] : [],
});
