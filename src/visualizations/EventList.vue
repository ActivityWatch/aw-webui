<template lang="pug">

div
  b-card.event-container(no-block=true)
    span(slot="header")
      h4.card-title Events
      span.pagination-header
        | Showing {{ events.length }} events
      b-button(@click="expandList", size="sm", style="float: right;")
        span(v-if="!isListExpanded")
          | Expand list
        span(v-else)
          | Condense list

    ul.event-list(:class="{ 'expand': isListExpanded }")
      li(v-for="event in events")
          span.event
            span.field(:title="event.timestamp")
              icon(name="calendar")
              | {{ event.timestamp | friendlytime }}
            span.field
              icon(name="clock")
              | {{ event.duration | friendlyduration }}
            span(v-for="(val, key) in event.data").field
              icon(name="tags")
              // TODO: Add some kind of highlighting to key
              | {{ key }}: {{ val }}
            span.field.float-right
              b-btn(v-b-modal="'edit-modal-' + event.id", variant="outline-dark" size="sm")
                | Edit

          event-editor(
            :event="event", :bucket_id="bucket_id",
            @save="(e) => $emit('save', e)", @delete="removeEvent"
          )
</template>

<style scoped lang="scss">
$border-color: #ddd;

.card {
  margin-bottom: 1em;

  .card-title {
    display: inline-block;
    margin-bottom: 0;
    margin-right: 1em;
  }

  .card-body {
    padding: 0;
  }
}

.event-list {
  list-style-type: none;
  padding: 0;
  border-radius: 3px;
  height: 25em;
  overflow-y: auto;
  white-space: nowrap;
  margin-bottom: 0px;

  li {
    border: 0 solid $border-color;
    border-width: 0 0 1px 0;
    border-radius: 4px;
    padding: 2px;

    &:last-child {
      border-width: 0;
    }
  }

  &.expand {
    height: 100%;
  }
}

.event {
  display: inline-block;
  padding: 0.3em;
  clear: both;
}

.pagination-header {
  font-size: 12pt;
  color: #666;
  margin-bottom: 10px;
}

.field {
  margin: 0 5px 0 0;
  font-size: 11pt;
  padding: 3px 5px 3px 5px;
  background-color: #ddd;
  border: 1px solid #ccc;
  border-radius: 2px;

  &:last-child {
    margin-right: 0;
  }
}

/* Flips the outer element once, then all direct children once,
   leaving the scrollbar in the first flipped yet the content correct */
.scrollbar-flipped,
.scrollbar-flipped > * {
  transform: rotateX(180deg);
  -ms-transform: rotateX(180deg); /* IE 9 */
  -webkit-transform: rotateX(180deg); /* Safari and Chrome */
}
</style>

<script>
import 'vue-awesome/icons/tags';
import 'vue-awesome/icons/clock';
import 'vue-awesome/icons/calendar';

import EventEditor from '~/components/EventEditor.vue';

export default {
  name: 'EventList',
  components: {
    'event-editor': EventEditor,
  },
  props: {
    bucket_id: String,
    events: Array,
  },
  data: function () {
    return {
      isListExpanded: false,
    };
  },
  methods: {
    expandList: function () {
      this.isListExpanded = !this.isListExpanded;
      console.log('List should be expanding: ', this.isListExpanded);
    },
    removeEvent: function (event) {
      this.events = this.events.filter(e => e.id != event.id);
    },
  },
};
</script>
