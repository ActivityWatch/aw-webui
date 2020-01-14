<template lang="pug">
div
  table(style="width: 100%")
    tr
      th Bucket
      td {{ bucket_id }}
    tr
      th ID
      td {{ event.id }}
    tr
      th Start
      datetime(type="datetime" v-model="start")
    tr
      th End
      datetime(type="datetime" v-model="end")
    tr
      th Duration
      td {{ editedEvent.duration | friendlyduration }}

  hr

  table(style="width: 100%")
    tr
      th Key
      th Value
    tr(v-for="(v, k) in event.data")
      td
        b-input(disabled, :value="k", size="sm")
      td
        b-checkbox(v-if="typeof event.data[k] === typeof true", v-model="editedEvent.data[k]", style="margin: 0.25em")
        b-input(v-if="typeof event.data[k] === typeof 'string'", v-model="editedEvent.data[k]", size="sm")

  hr

  div.float-right
    b-button.mx-1(@click="$emit('close');")
      | Cancel
    b-button.mx-1(@click="save(); $emit('close');", variant="primary")
      | Save
</template>

<style lang="scss">
</style>

<script>
import moment from 'moment';


export default {
  name: "EventEditor",
  props: {
    event: Object,
    bucket_id: String,
  },
  data() {
    return {
      editedEvent: JSON.parse(JSON.stringify(this.event)),
    }
  },
  computed: {
    start: {
      get: function() {
        return moment(this.editedEvent.timestamp).format();
      },
      set: function(dt) {
        const start = moment(dt);
        const end = moment(this.end);
        this.editedEvent.timestamp = start.format();
        this.editedEvent.duration = end.diff(start, 'seconds');
      }
    },
    end: {
      get: function() {
        const end = moment(this.editedEvent.timestamp).add(this.editedEvent.duration, 'seconds');
        return end.format();
      },
      set: function(dt) {
        this.editedEvent.duration = moment(dt).diff(this.editedEvent.timestamp, 'seconds');
      },
    },
  },
  methods: {
    async save() {
      await this.$aw.replaceEvent(this.bucket_id, this.editedEvent);
      this.$emit('save', this.editedEvent);
    },
  }
}
</script>
