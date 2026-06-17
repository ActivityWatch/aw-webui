<template lang="pug">
div.pcd-admin-panel
  small.pcd-trigger(@click="panelVisible = !panelVisible" title="PCD Admin") PCD
  div.pcd-panel(v-if="panelVisible")
    hr.mt-1
    h6.text-muted.mb-3 PCD Admin
    div(v-if="!authenticated")
      b-form-group(label="Username" label-cols-md="3" label-size="sm")
        b-form-input(
          v-model="username"
          type="email"
          placeholder="admin@example.com"
          size="sm"
          :disabled="loading"
          @keyup.enter="verifyAdmin"
        )
      b-form-group(label="Password" label-cols-md="3" label-size="sm")
        b-input-group(size="sm")
          b-form-input(
            v-model="password"
            type="password"
            placeholder="Admin password"
            :disabled="loading"
            @keyup.enter="verifyAdmin"
          )
          b-input-group-append
            b-button(variant="outline-secondary" size="sm" @click="verifyAdmin" :disabled="loading || !username || !password")
              | {{ loading ? 'Checking…' : 'Unlock' }}
      b-alert(v-if="authError" show variant="danger" dismissible @dismissed="authError = ''") {{ authError }}
    div(v-if="authenticated")
      b-form-group(label="PCD user email" label-cols-md="3" label-size="sm")
        b-input-group(size="sm")
          b-form-input(
            v-model="email"
            type="email"
            placeholder="user@example.com"
            :state="emailState"
            @keyup.enter="saveEmail"
          )
          b-input-group-append
            b-button(
              variant="outline-primary"
              size="sm"
              @click="saveEmail"
              :disabled="saving || !emailChanged || emailState === false"
            ) {{ saving ? 'Saving…' : 'Save' }}
        b-form-invalid-feedback Invalid email address.
      b-alert(v-if="saveError" show variant="danger" dismissible @dismissed="saveError = ''") {{ saveError }}
      b-alert(v-if="saveSuccess" show variant="success" dismissible @dismissed="saveSuccess = false")
        | Email updated. PCD sync will use the new address on the next cycle.
      small.text-muted
        | Changes take effect without reinstalling the app.
        | &#32;
        a(href="#" @click.prevent="lock") Sign out
</template>

<script lang="ts">
const API_BASE = '/api/0/pcd';

export default {
  name: 'PCDAdminPanel',
  data() {
    return {
      panelVisible: false,
      username: '',
      password: '',
      loading: false,
      authError: '',
      authenticated: false,
      sessionToken: '',
      email: '',
      originalEmail: '',
      saving: false,
      saveError: '',
      saveSuccess: false,
    };
  },
  computed: {
    emailState(): boolean | null {
      if (!this.email) return null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
    },
    emailChanged(): boolean {
      return this.email !== this.originalEmail;
    },
  },
  methods: {
    async verifyAdmin() {
      if (!this.username || !this.password) return;
      this.loading = true;
      this.authError = '';
      try {
        const res = await fetch(`${API_BASE}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username, password: this.password }),
        });
        if (res.ok) {
          const data = await res.json();
          this.sessionToken = data.token;
          this.authenticated = true;
          await this.loadEmail();
        } else {
          const data = await res.json().catch(() => ({}));
          this.authError = data.error || 'Invalid credentials.';
          this.password = '';
        }
      } catch {
        this.authError = 'Could not reach the local server.';
      } finally {
        this.loading = false;
      }
    },
    async loadEmail() {
      try {
        const res = await fetch(`${API_BASE}/email`, {
          headers: { 'X-PCD-Admin-Token': this.sessionToken },
        });
        if (res.ok) {
          const data = await res.json();
          this.email = data.email || '';
          this.originalEmail = this.email;
        }
      } catch {
        // non-fatal
      }
    },
    async saveEmail() {
      if (!this.emailChanged || this.emailState === false) return;
      this.saving = true;
      this.saveError = '';
      this.saveSuccess = false;
      try {
        const res = await fetch(`${API_BASE}/email`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-PCD-Admin-Token': this.sessionToken,
          },
          body: JSON.stringify({ new_email: this.email }),
        });
        if (res.ok) {
          this.originalEmail = this.email;
          this.saveSuccess = true;
        } else {
          const data = await res.json().catch(() => ({}));
          this.saveError = data.error || 'Failed to save email.';
        }
      } catch {
        this.saveError = 'Could not reach the local server.';
      } finally {
        this.saving = false;
      }
    },
    lock() {
      this.authenticated = false;
      this.sessionToken = '';
      this.username = '';
      this.password = '';
      this.email = '';
      this.originalEmail = '';
      this.saveSuccess = false;
      this.saveError = '';
    },
  },
};
</script>

<style scoped>
.pcd-admin-panel {
  text-align: right;
}
.pcd-trigger {
  cursor: pointer;
  opacity: 0.25;
  font-size: 0.65em;
  user-select: none;
}
.pcd-trigger:hover {
  opacity: 0.55;
}
.pcd-panel {
  text-align: left;
  margin-top: 0.5rem;
}
</style>
