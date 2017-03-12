<template lang="jade">
h2 Buckets

hr

div.pagination-header

accordion(:one-at-atime="false")
  panel(v-for="bucket in buckets", :header="bucket.id", :is-open="true")
    div.actions
      a(v-link="'/buckets/' + bucket.id")
        button.btn.btn-default.btn-sm(type="button")
          span.glyphicon.glyphicon-folder-open(aria-hidden="true")
          | Open bucket
      a(v-bind:href="'/api/0/buckets/' + bucket.id + '/events'")
        button.btn.btn-default.btn-sm(type="button" data-toggle="tooltip" data-placement="bottom" title="Not implemented")
          span.glyphicon.glyphicon-save(aria-hidden="true")
          | Export as JSON
      div(v-if="bucket.last_updated", style="margin-top: 0.5em; font-size: 10pt; color: #666")
        // More precisely prints time since the last event ending
        span
          | Last updated:
        span(style="width: 8em; margin-left: 0.5em; display: inline-block")
          | {{ bucket.last_updated | friendlytime }}
      //a(v-link="'/not_implemented'")
        tooltip(trigger="hover" effect="scale" placement="bottom" content="Not implemented")
          button.btn.btn-default.btn-sm(type="button" data-toggle="tooltip" data-placement="bottom" title="Not implemented")
            span.glyphicon.glyphicon-tower(aria-hidden="true")
            | Convert to Vault (No impl)
      //a(v-link="'/not_implemented'")
        tooltip(trigger="hover" effect="scale" placement="bottom" content="Not implemented")
          button.btn.btn-default.btn-sm(type="button" data-toggle="tooltip" data-placement="bottom" title="Not implemented")
            span.glyphicon.glyphicon-lock(aria-hidden="true")
            | Permissions (No impl)
    //br
    //| Hostname: {{ bucket.hostname }}
    //br
    //| Client: {{ bucket.client }}
    //br
    //| # of events: Not implemented

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

var tooltip = require('vue-strap').tooltip;
var accordion = require('vue-strap').accordion;
var panel = require('vue-strap').panel;

let $Bucket = Resources.$Bucket;

export default {
  name: "Buckets",
  ready: function() {
    this.getBuckets();
  },
  components: {
    'tooltip': tooltip,
    'accordion': accordion,
    'panel': panel
  },
  data: () => {
    return {
      buckets: [],
    }
  },
  methods: {
    getBuckets: function() {
      $Bucket.get().then((response) => {
        this.$set('buckets', response.json())
      });
    },

    getBucketInfo: function(bucket_id) {
      $Bucket.get({"id": bucket_id}).then((response) => {
        this.$set('buckets.'+bucket_id, response.json())
      });
    }
  }
}
</script>
