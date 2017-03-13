<template lang="jade">
h2 Server Log

hr

accordion(:one-at-atime="false")
  panel(v-for="logmsg in log", :header="logmsg.levelname+':'+logmsg.message", :is-open="false")
    | Name: {{ logmsg.name }}
    br
    | Time: {{ logmsg.asctime }}
    br
    | Origin: {{ logmsg.funcName }}:{{ logmsg.lineno }}

</template>

<style lang="scss">
.panel-default {
  border-color: #BBB;
  border-radius: 4px;

  .panel-heading {
    background-color: #eee;
    border-color: #ccc;
    border-radius: 4px;
  }
}

.actions {
  margin: -5px;

  a {
    margin-right: 5px;

    button > span {
      margin-right: 5px;
    }
  }
}

</style>

<script>
import Resources from '../resources.js';

var accordion = require('vue-strap').accordion;
var panel = require('vue-strap').panel;

let $Log = Resources.$Log;

export default {
  name: "Log",
  mounted: function() {
    this.getLog();
  },
  components: {
    'accordion': accordion,
    'panel': panel
  },
  data: () => {
    return {
      log: [],
    }
  },
  methods: {
    getLog: function() {
      $Log.get().then((response) => {
        this.$set('log', response.json())
      });
    },
  }
}
</script>
