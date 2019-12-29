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
      td {{ event.timestamp | iso8601 }}
    tr
      th End
      td {{ 1 * event.timestamp + 1000 * event.duration | iso8601 }}
    tr
      th Duration
      td {{ event.duration | friendlyduration }}

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
  methods: {
    async save() {
      await this.$aw.replaceEvent(this.bucket_id, this.editedEvent);
      this.$emit('save', this.editedEvent);
    }
  }
}
</script>
