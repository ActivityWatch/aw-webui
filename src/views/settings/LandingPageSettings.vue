<template lang="pug">
div.row
  div.col-sm-9
    h5.mb-0 Landing page
    small
      | The page to open when opening ActivityWatch, or clicking the logo in the top menu.
  div.col-sm-3
    select(v-if="loaded", id="landingpage" :value="landingpage", @change="set($event.target.value)")
      option(value="/home") Home
      option(:value="'/activity/' + hostname + '/view/'" v-for="hostname in hostnames") Activity ({{hostname}})
      option(value="/timeline") Timeline
    span(v-else)
      | Loading...
</template>
<script>
export default {
  name: 'LandingPageSettings',
  data: () => {
    return {
      landingpage: localStorage.landingpage || '/home',
      loaded: false,
    };
  },
  computed: {
    hostnames() {
      return Object.keys(this.$store.getters['buckets/bucketsByHostname']);
    },
  },
  async mounted() {
    this.landingpage = localStorage.landingpage || '/home';
    await this.$store.dispatch('buckets/ensureBuckets');
    this.loaded = true;
  },
  methods: {
    set: function (landingpage) {
      localStorage.landingpage = landingpage;
      console.log('Set landingpage to ' + landingpage);
    },
  },
};
</script>
