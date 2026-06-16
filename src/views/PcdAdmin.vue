<template lang="pug">
div
  h3 PCD Admin

  hr

  div(v-if="!token")
    b-card(header="Admin Sign In" header-tag="h5" style="max-width: 520px;")
      b-alert(v-if="loginError" show variant="danger") {{ loginError }}
      b-form(@submit.prevent="login")
        b-form-group(label="Admin email" label-cols-md="3")
          b-form-input(
            v-model="username"
            type="email"
            placeholder="admin@prescribingcaredirect.co.uk"
            required
            autofocus
          )
        b-form-group(label="Password" label-cols-md="3")
          b-form-input(v-model="password" type="password" required)
        b-button(type="submit" variant="primary" :disabled="loginLoading")
          b-spinner(v-if="loginLoading" small type="border")
          | {{ loginLoading ? ' Signing in…' : ' Sign in' }}

  div(v-else)
    b-alert(v-if="successMsg" show variant="success" dismissible @dismissed="successMsg = ''") {{ successMsg }}
    b-alert(v-if="updateError" show variant="danger" dismissible @dismissed="updateError = ''") {{ updateError }}

    b-card(header="Registered activity email" header-tag="h5" style="max-width: 520px;")
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
        b-button.ml-2(variant="outline-secondary" @click="logout") Sign out
</template>

<script lang="ts">
export default {
  name: 'PcdAdmin',

  data() {
    return {
      // login form
      username: '',
      password: '',
      loginLoading: false,
      loginError: '',
      // session
      token: '',
      // dashboard
      currentEmail: '',
      newEmail: '',
      updateLoading: false,
      updateError: '',
      successMsg: '',
    };
  },

  methods: {
    async login() {
      this.loginLoading = true;
      this.loginError = '';
      try {
        const res = await fetch('/api/0/pcd/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username, password: this.password }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          this.token = data.token;
          this.password = '';
          await this.fetchEmail();
        } else {
          this.loginError = data.error || 'Invalid credentials.';
        }
      } catch {
        this.loginError = 'Could not reach the server.';
      } finally {
        this.loginLoading = false;
      }
    },

    async fetchEmail() {
      try {
        const res = await fetch('/api/0/pcd/email', {
          headers: { 'X-PCD-Admin-Token': this.token },
        });
        if (res.ok) {
          const data = await res.json();
          this.currentEmail = data.email || '';
        }
      } catch {
        // non-fatal — email will just show as (not set)
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
          this.newEmail = '';
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
      this.currentEmail = '';
      this.newEmail = '';
      this.successMsg = '';
      this.updateError = '';
    },
  },
};
</script>
