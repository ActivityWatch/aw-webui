<template lang="pug">
div
  h3 Developer zone
  | Just some tools to aid in development and debugging.

  hr

  div
    h4.my-3 Query testing
    b-btn(@click="query_window_timing()") Run window query
    b-btn(@click="query_browser_timing()") Run browser query

  hr

  div
    h4.my-3 Blockstack Gaia testing
    div(v-if="!signedIn")
      div Not logged in
      b-btn(@click="signin()") Sign in
    div(v-else)
      div Logged in!
      div {{ profile }}
      b-btn(@click="signout()") Sign out

      hr

      b-btn.mr-2(@click="listFiles()") List files
      b-btn.mr-2(@click="getFile()") Get file
      b-btn.mr-2(@click="putFile()") Put file
      b-btn.mr-2(@click="sync()") Sync
</template>

<script>
import moment from 'moment';
import { mapState, mapActions, mapGetters } from 'vuex';

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
      bsSession: null,
    };
  },
  computed: {
    ...mapGetters('blockstack', ['profile']),
    ...mapState('blockstack', ['signedIn']),
  },
  async mounted() {
    this.bsSession = await this.loadSession();
    console.log(this.bsSession);
  },
  methods: {
    query_window_timing: async function() {
      await this.$store.dispatch('activity_daily/query_window', this.queryOptions);
    },
    query_browser_timing: async function() {
      await this.$store.dispatch('activity_daily/query_browser', this.queryOptions);
    },
    loadSession: async function() {
      return await this.$store.dispatch('blockstack/loadSession', { authResponse: this.$route.query.authResponse });
    },
    sync: async function() {
      await this.putFile({ filename: 'erb-laptop2-arch/index', data: JSON.stringify({ buckets: ["erb-laptop2-arch", "erb-main2-arch"] })});
      let result = await this.getFile('erb-laptop2-arch/index');
      console.log(result);
    },
    ...mapActions('blockstack', ['signin', 'signout', 'listFiles', 'getFile', 'putFile']),
  }
}
</script>
