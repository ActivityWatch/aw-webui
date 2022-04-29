<template lang="pug">
div
  iframe(:src='src', frameborder='0')
</template>

<script lang="js">
import moment from 'moment';
import { useActivityStore } from '~/stores/activity';

export default {
  name: 'aw-custom-watcher',
  props: {
    visname: String,
    title: String,
  },
  computed: {
    src: function () {
      const options = useActivityStore().query_options;
      const start = options.timeperiod.start;
      const end = moment(start).add(...options.timeperiod.length).toISOString();
      const urlParams = new URLSearchParams({
        hostname: options.host,
        start,
        end,
      });
      let _origin = document.location.origin;
      if(document.location.port == "27180") {
        // NOTE: document.location.origin won't work when running aw-webui in dev mode
        _origin = "http://localhost:5666"
      }
      return _origin + '/pages/' + this.visname + '/?' + urlParams.toString();
    },
  },
};
</script>
