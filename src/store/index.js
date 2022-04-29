import Vue from 'vue';
import Vuex from 'vuex';
import activity from './modules/activity';
import buckets from './modules/buckets';
import categories from './modules/categories';
import views from './modules/views';
//import createLogger from '../../../src/plugins/logger';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
  modules: {
    activity,
    buckets,
    categories,
    views,
  },
  strict: debug,
  //  plugins: debug ? [createLogger()] : [],
});
