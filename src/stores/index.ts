// Initializes Pinia, does not import stores

import { createPinia, PiniaVuePlugin } from 'pinia';
import Vue from 'vue';

Vue.use(PiniaVuePlugin); // Only needed for Vue 2

const rootStore = createPinia();
export default rootStore;
