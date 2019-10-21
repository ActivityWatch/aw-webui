<template lang="pug">
div
  h3 Developer zone
  | Just some tools to aid in development and debugging.

  div
    h4 Query testing
    b-btn(@click="query_window_timing()") Run window query
    b-btn(@click="query_browser_timing()") Run browser query

  div
    h4 Blockstack Gaia testing
    div(v-if="signedIn")
      | Logged in!
      div {{ profile }}
      b-btn(@click="signout()") Sign out
    div(v-else)
      | Not logged in
      b-btn(@click="signin()") Sign in
</template>

<script>
import moment from 'moment';
import { mapState, mapActions } from 'vuex';

export default {
  name: "aw-dev",

  data: function() {
    return {
      queryOptions: {
        aw_client: this.$aw,
        date: moment().format('YYYY-MM-DD'),
        host: 'erb-laptop2-arch',
        filterAFK: true,
        browserBuckets: ["aw-watcher-web-firefox-imported-2019-10-03T1"],
      },
    };
  },
  computed: {
    ...mapState('blockstack', ['signedIn', 'profile']),
  },
  mounted() {
    this.loadSession();
  },
  methods: {
    query_window_timing: async function() {
      await this.$store.dispatch('activity_daily/query_window', this.queryOptions);
    },
    query_browser_timing: async function() {
      await this.$store.dispatch('activity_daily/query_browser', this.queryOptions);
    },
    loadSession: async function() {
      await this.$store.dispatch('blockstack/loadSession', { authResponse: this.$route.query.authResponse });
    },
    ...mapActions('blockstack', ['signin', 'signout']),
  }
}
</script>
