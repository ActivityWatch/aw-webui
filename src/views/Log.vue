<template lang="pug">
div
  h2 Server Log

  hr

  accordion(:one-at-atime="false")
    panel(v-for="(log, key) in logs", :key="key", :header="log.levelname+':'+log.message", :is-open="false")
      | Name: {{ logm.name }}
      br
      | Time: {{ log.asctime }}
      br
      | Origin: {{ log.funcName }}:{{ log.lineno }}

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
export default {
  name: "Log",
  data: () => {
    return {
      logs: [],
    }
  },
  mounted: function() {
    this.getLog();
  },
  methods: {
    getLog: function() {
      $Log.get().then((response) => {
        this.logs = response.json();
      });
    },
  }
}
</script>
