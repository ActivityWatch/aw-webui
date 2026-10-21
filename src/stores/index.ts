// Initializes Pinia, does not import stores
// NOTE: In Vue 3, PiniaVuePlugin is not needed. Pinia is registered via app.use(pinia) in main.js.

import { createPinia } from 'pinia';

const rootStore = createPinia();
export default rootStore;
