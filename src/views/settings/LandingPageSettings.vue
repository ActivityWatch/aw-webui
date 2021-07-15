<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('landing') }}
    div
      b-select.landingpage(v-if="loaded" size="sm" :value="landingpage", @change="set($event)")
        option(value="/home") {{ $t('home') }}
        option(:value="'/activity/' + hostname + '/view/'" v-for="hostname in hostnames") {{ $t('activity') }} ({{hostname}})
        option(value="/timeline") {{ $t('timeline') }}
      span(v-else)
        | {{ $t('loading') }}
  small
    | {{ $t('landingHelp') }}
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
