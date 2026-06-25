<template lang="pug">
div
  h3 PCD Admin

  hr

  div(v-if="!token")
    b-card(header="Admin Sign In" header-tag="h5" style="max-width: 520px;")
      b-alert(v-if="loginError" show variant="danger") {{ loginError }}
      b-form(@submit.prevent="login")
        b-form-group(label="Password" label-cols-md="3")
          b-form-input(v-model="password" type="password" required autofocus)
        b-button(type="submit" variant="primary" :disabled="loginLoading")
          b-spinner(v-if="loginLoading" small type="border")
          | {{ loginLoading ? ' Signing in…' : ' Sign in' }}

  div(v-else)
    b-row.mb-4
      b-col(md="6")
        b-card(header="Server URL" header-tag="h5")
          b-alert(v-if="configError" show variant="danger" dismissible @dismissed="configError = ''") {{ configError }}
          b-alert(v-if="configSuccess" show variant="success" dismissible @dismissed="configSuccess = ''") {{ configSuccess }}
          p.mb-3
            | Active:&nbsp;
            strong {{ serverUrl || '(not set)' }}
          b-form(@submit.prevent="saveConfig")
            b-form-group(label="Environment" label-cols-md="3")
              b-form-select(v-model="selectedPreset" :options="envOptions" @change="onPresetChange")
            b-form-group(v-if="selectedPreset === 'custom'" label="Custom URL" label-cols-md="3")
              b-form-input(
                v-model="customUrl"
                type="url"
                placeholder="https://api.example.com"
                required
              )
            b-button(type="submit" variant="primary" :disabled="configLoading")
              b-spinner(v-if="configLoading" small type="border")
              | {{ configLoading ? ' Saving…' : ' Save URL' }}
            b-button.ml-2(variant="outline-secondary" @click="logout") Sign out

      b-col(md="6")
        b-card(header="Registered activity email" header-tag="h5")
          b-alert(v-if="updateError" show variant="danger" dismissible @dismissed="updateError = ''") {{ updateError }}
          b-alert(v-if="successMsg" show variant="success" dismissible @dismissed="successMsg = ''") {{ successMsg }}
          p.mb-3
            | Current:&nbsp;
            strong {{ currentEmail || '(not set)' }}
          b-form(@submit.prevent="updateEmail")
            b-form-group(label="New email" label-cols-md="3")
              b-form-input(
                v-model="newEmail"
                type="email"
                placeholder="user@prescribingcaredirect.co.uk"
                required
              )
            b-button(type="submit" variant="primary" :disabled="updateLoading")
              b-spinner(v-if="updateLoading" small type="border")
              | {{ updateLoading ? ' Updating…' : ' Update & validate' }}

    b-card(header="Sync Logs" header-tag="h5")
      b-alert(v-if="logsError" show variant="danger" dismissible @dismissed="logsError = ''") {{ logsError }}
      div.d-flex.align-items-center.mb-2
        small.text-muted.mr-auto Last {{ logs.length }} entries (newest first)
        b-button(size="sm" variant="outline-secondary" @click="fetchLogs" :disabled="logsLoading")
          b-spinner(v-if="logsLoading" small type="border")
          | {{ logsLoading ? '' : ' Refresh' }}
      div(v-if="logs.length === 0 && !logsLoading")
        p.text-muted.mb-0 No sync activity yet.
      b-table-simple(v-else small bordered responsive)
        b-tbody
          b-tr(v-for="(entry, i) in logs" :key="i")
            b-td(style="width:180px; white-space:nowrap; font-family:monospace; font-size:0.8em")
              | {{ formatTs(entry.ts) }}
            b-td(style="width:80px")
              b-badge(:variant="levelVariant(entry.level)") {{ entry.level }}
            b-td(style="font-size:0.85em")
              | {{ entry.msg }}
              span.text-muted(v-if="entry.detail")  — {{ entry.detail }}
</template>

<script lang="ts">
const ENV_URLS: Record<string, string> = {
  local: 'http://127.0.0.1:8005',
  dev:   'https://api.dev.prescribingcaredirect.co.uk',
  qa:    'https://api.qa.prescribingcaredirect.co.uk',
  prod:  'https://api.prescribingcaredirect.co.uk',
};

export default {
  name: 'PcdAdmin',

  data() {
    return {
      // login
      password: '',
      loginLoading: false,
      loginError: '',
      // session
      token: '',
      // server url config
      serverUrl: '',
      selectedPreset: 'dev',
      customUrl: '',
      configLoading: false,
      configError: '',
      configSuccess: '',
      // email
      currentEmail: '',
      newEmail: '',
      updateLoading: false,
      updateError: '',
      successMsg: '',
      // logs
      logs: [],
      logsLoading: false,
      logsError: '',
    };
  },

  computed: {
    envOptions() {
      return [
        { value: 'local', text: `Local — ${ENV_URLS.local}` },
        { value: 'dev',   text: `Dev — ${ENV_URLS.dev}` },
        { value: 'qa',    text: `QA — ${ENV_URLS.qa}` },
        { value: 'prod',  text: `Prod — ${ENV_URLS.prod}` },
        { value: 'custom', text: 'Custom URL…' },
      ];
    },
  },

  methods: {
    async login() {
      this.loginLoading = true;
      this.loginError = '';
      try {
        const res = await fetch('/api/0/pcd/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: this.password }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          this.token = data.token;
          this.password = '';
          await Promise.all([this.fetchConfig(), this.fetchEmail(), this.fetchLogs()]);
        } else {
          this.loginError = data.error || 'Invalid password.';
        }
      } catch {
        this.loginError = 'Could not reach the server.';
      } finally {
        this.loginLoading = false;
      }
    },

    async fetchConfig() {
      try {
        const res = await fetch('/api/0/pcd/config', {
          headers: { 'X-PCD-Admin-Token': this.token },
        });
        if (res.ok) {
          const data = await res.json();
          this.serverUrl = data.base_url || '';
          // match current URL to a preset
          const match = Object.entries(ENV_URLS).find(([, url]) => url === this.serverUrl);
          this.selectedPreset = match ? match[0] : 'custom';
          if (this.selectedPreset === 'custom') {
            this.customUrl = this.serverUrl;
          }
        }
      } catch {
        // non-fatal
      }
    },

    onPresetChange(val: string) {
      if (val !== 'custom') {
        this.customUrl = '';
      }
    },

    async saveConfig() {
      this.configLoading = true;
      this.configError = '';
      this.configSuccess = '';
      const url = this.selectedPreset === 'custom' ? this.customUrl : ENV_URLS[this.selectedPreset];
      try {
        const res = await fetch('/api/0/pcd/config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-PCD-Admin-Token': this.token,
          },
          body: JSON.stringify({ base_url: url }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          this.serverUrl = data.base_url;
          this.configSuccess = `Server URL saved: ${data.base_url}`;
        } else {
          this.configError = data.error || 'Failed to save URL.';
        }
      } catch {
        this.configError = 'Could not reach the server.';
      } finally {
        this.configLoading = false;
      }
    },

    async fetchLogs() {
      this.logsLoading = true;
      this.logsError = '';
      try {
        const res = await fetch('/api/0/pcd/logs', {
          headers: { 'X-PCD-Admin-Token': this.token },
        });
        if (res.ok) {
          const data = await res.json();
          this.logs = data.logs || [];
        } else {
          this.logsError = 'Failed to load logs.';
        }
      } catch {
        this.logsError = 'Could not reach the server.';
      } finally {
        this.logsLoading = false;
      }
    },

    formatTs(ts: string): string {
      try {
        return new Date(ts).toLocaleString();
      } catch {
        return ts;
      }
    },

    levelVariant(level: string): string {
      const map: Record<string, string> = {
        success: 'success',
        error: 'danger',
        warning: 'warning',
        info: 'secondary',
      };
      return map[level] || 'light';
    },

    async fetchEmail() {
      try {
        const res = await fetch('/api/0/pcd/email', {
          headers: { 'X-PCD-Admin-Token': this.token },
        });
        if (res.ok) {
          const data = await res.json();
          this.currentEmail = data.email || '';
          this.newEmail = data.email || '';
        }
      } catch {
        // non-fatal
      }
    },

    async updateEmail() {
      this.updateLoading = true;
      this.updateError = '';
      this.successMsg = '';
      try {
        const res = await fetch('/api/0/pcd/email', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-PCD-Admin-Token': this.token,
          },
          body: JSON.stringify({ new_email: this.newEmail }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          this.currentEmail = data.email;
          this.newEmail = data.email;
          this.successMsg = `Email updated to ${data.email}`;
        } else {
          this.updateError = data.error || 'Update failed.';
        }
      } catch {
        this.updateError = 'Could not reach the server.';
      } finally {
        this.updateLoading = false;
      }
    },

    logout() {
      this.token = '';
      this.serverUrl = '';
      this.currentEmail = '';
      this.newEmail = '';
      this.password = '';
      this.successMsg = '';
      this.updateError = '';
      this.configError = '';
      this.configSuccess = '';
      this.logs = [];
      this.logsError = '';
    },
  },
};
</script>
