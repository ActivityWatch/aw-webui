<template lang="pug">
b-modal(id="cors-config-modal" title="Security & CORS" @show="load" @ok="save" :ok-disabled="loading || !config" size="lg")
  div(v-if="config")
    b-alert(v-if="config.needs_restart" show variant="warning" class="mb-4")
      h5.alert-heading ⚠️ Server Restart Required
      p.mb-0
        | CORS settings are only applied once at startup. You must <b>stop and restart the server</b> for any changes made here to take effect.

    b-form-group(label="Fixed CORS origins" label-cols-md=4 description="Configure general CORS origins with exact matches (e.g. http://localhost:8080). Comma-separated.")
      b-input(v-model="corsStr" type="text" :disabled="isFixed('cors')")
      small.text-warning(v-if="isFixed('cors')")
        | ⚠️ Fixed in <code>config.toml</code>. Settings in the configuration file take precedence and cannot be changed here.

    b-form-group(label="Regex CORS origins" label-cols-md=4 description="Configure CORS origins with regular expressions. Useful for browser extensions (e.g. chrome-extension://.* or moz-extension://.*). Comma-separated.")
      b-input(v-model="corsRegexStr" type="text" :disabled="isFixed('cors_regex')")
      small.text-warning(v-if="isFixed('cors_regex')")
        | ⚠️ Fixed in <code>config.toml</code>. Settings in the configuration file take precedence and cannot be changed here.

    h5.mt-4 Extensions Shortcuts
    b-form-group(label-cols-md=4)
      b-form-checkbox(v-model="editable.cors_allow_aw_chrome_extension" :disabled="isFixed('cors_allow_aw_chrome_extension')") Allow ActivityWatch extension (Chrome)
      template(#description)
        div Chrome extensions use a stable, persistent ID, so the official extension is reliably supported.
        small.text-warning(v-if="isFixed('cors_allow_aw_chrome_extension')")
          | ⚠️ Fixed in <code>config.toml</code>. Settings in the configuration file take precedence and cannot be changed here.

    b-form-group(label-cols-md=4)
      b-form-checkbox(v-model="editable.cors_allow_all_mozilla_extension" :disabled="isFixed('cors_allow_all_mozilla_extension')") Allow all Firefox extensions (DANGEROUS)
      template(#description)
        div Every version of a Mozilla extension has its own ID to avoid fingerprinting. This is why you must either allow all extensions or manually configure your specific ID.
        small.text-warning.mb-2.d-block(v-if="isFixed('cors_allow_all_mozilla_extension')")
          | ⚠️ Fixed in <code>config.toml</code>. Settings in the configuration file take precedence and cannot be changed here.
        div.mt-2.text-danger(v-if="editable.cors_allow_all_mozilla_extension")
          | ⚠️ DANGEROUS: Not recommended for security. If enabled, any installed extension can access your ActivityWatch data. Use this only if you know what extensions you have and assume full responsibility.
        div(v-else)
          | Recommended for security. To allow a specific extension safely:
          ol.mt-2.mb-1
            li Go to <code>about:debugging#/runtime/this-firefox</code> in your browser.
            li Look for your extension and copy the <b>Manifest URL</b> (e.g. <code>moz-extension://4b931c07dededdedff152/manifest.json</code>).
            li Remove <code>manifest.json</code> from the end (to get <code>moz-extension://4b931c07dededdedff152</code>).
            li Paste it into the <b>Regex CORS origins</b> field above (use a comma to separate if not empty). 

  div(v-else-if="loading")
    p Loading...
  div(v-else-if="error")
    b-alert(show variant="danger") Failed to load CORS configuration: {{ error }}
</template>

<script lang="ts">
import { useCorsStore, type CorsConfig } from '~/stores/cors';
import { mapState } from 'pinia';

export default {
  name: 'CorsConfigModal',
  data() {
    return {
      editable: {
        cors: [] as string[],
        cors_regex: [] as string[],
        cors_allow_aw_chrome_extension: false,
        cors_allow_all_mozilla_extension: false,
        in_file: [] as string[],
        needs_restart: false,
      } as CorsConfig,
      corsStr: '',
      corsRegexStr: '',
      corsStore: useCorsStore(),
    };
  },
  computed: {
    ...mapState(useCorsStore, ['config', 'loading', 'error']),
  },
  watch: {
    config(newVal) {
      if (newVal) {
        this.editable = JSON.parse(JSON.stringify(newVal));
        this.corsStr = newVal.cors.join(', ');
        this.corsRegexStr = newVal.cors_regex.join(', ');
      }
    },
  },
  methods: {
    isFixed(field: string): boolean {
      return this.config?.in_file?.includes(field) || false;
    },
    async load() {
      await this.corsStore.load();
    },
    async save(bvModalEvt: any) {
      bvModalEvt.preventDefault();
      
      // Parse comma-separated strings back to arrays
      this.editable.cors = this.corsStr.split(',').map(s => s.trim()).filter(s => s !== '');
      this.editable.cors_regex = this.corsRegexStr.split(',').map(s => s.trim()).filter(s => s !== '');

      try {
        await this.corsStore.save(this.editable);
        (this as any).$bvModal.hide('cors-config-modal');
        alert('CORS configuration saved! Please restart the server to apply changes.');
      } catch (e: any) {
        const msg = e.response?.data?.message || e.message || 'Unknown error';
        alert('Failed to save: ' + msg);
      }
    },
  },
};
</script>
