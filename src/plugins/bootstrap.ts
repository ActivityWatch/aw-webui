// Registers all bootstrap-vue-next components (BButton → `b-button`) and
// directives (vBTooltip → `v-b-tooltip`) globally, like Vue.use(BootstrapVue)
// did with bootstrap-vue. createBootstrap() only installs the plugins (modal
// and toast controllers etc.), not the components.
import type { App } from 'vue';
import * as components from 'bootstrap-vue-next/components';
import * as directives from 'bootstrap-vue-next/directives';

export default {
  install(app: App) {
    for (const [name, component] of Object.entries(components)) {
      if (name.startsWith('B')) app.component(name, component);
    }
    for (const [name, directive] of Object.entries(directives)) {
      // vBTooltip → BTooltip, which Vue resolves for `v-b-tooltip`
      app.directive(name.slice(1), directive);
    }
  },
};
