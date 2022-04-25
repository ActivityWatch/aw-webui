<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Landing page
    div
      b-select.landingpage(v-if="loaded" size="sm" :value="landingpage", @change="landingpage = $event")
        option(value="/home") Home
        option(:value="'/activity/' + hostname + '/view/'" v-for="hostname in hostnames") Activity ({{hostname}})
        option(value="/timeline") Timeline
      span(v-else)
        | Loading...
  small
    | The page to open when opening ActivityWatch, or clicking the logo in the top menu.
</template>
<script>
export default {
  name: 'LandingPageSettings',
  data: () => {
    return {
      loaded: false,
    };
  },
  computed: {
    landingpage: {
      get: function () {
        return this.$store.state.settings.landingpage || '/home';
      },
      set: function (val) {
        this.$store.dispatch('settings/update', { landingpage: val });
      },
    },
    hostnames() {
      return Object.keys(this.$store.getters['buckets/bucketsByHostname']);
    },
  },
  async mounted() {
    await this.$store.dispatch('buckets/ensureBuckets');
    this.loaded = true;
  },
};
</script>
