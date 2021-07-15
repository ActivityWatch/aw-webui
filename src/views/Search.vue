<template lang="pug">
div
  h3 {{ $t('search') }}

  b-alert(style="warning" show)
    | {{ $t('searchHelp') }}

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  b-input-group(size="lg")
    b-input(v-model="pattern" v-on:keyup.enter="search()" :placeholder="$t('regex')")
    b-input-group-append
      b-button(type="button", @click="search()" variant="success")
        icon(name="search")
        | {{ $t('search') }}

  div.d-flex.mt-1
    span.mr-auto.small(style="color: #666") {{ $t('hostname') }} {{hostname}}
    b-button(size="sm", variant="outline-dark" style="border: 0" @click="show_options = !show_options")
      span(v-if="!show_options")
        | #[icon(name="angle-double-down")] {{ $t('showOptions') }}
      span(v-else)
        | #[icon(name="angle-double-up")] {{ $t('hideOptions') }}

  div(v-if="show_options")
    h4 {{ $t('options') }}
    div {{ $t('hostname') }}
      select(v-model="hostname")
        option(v-for="hostname in Object.keys($store.getters['buckets/bucketsByHostname'])")
          | {{hostname}}
    div {{ $t('start') }} {{start.format()}}
    div {{ $t('end') }} {{stop.format()}}
    //div
      label Use regex
      input(type="checkbox" v-model="use_regex")
    div
      label {{ $t('filterAfk') }}
      input(type="checkbox" v-model="filter_afk")
    //div.form-row
      div.form-group.col-md-6
        | Start
        input.form-control(type="date", :max="today", v-model="startdate")
      div.form-group.col-md-6
        | End
        input.form-control(type="date", :max="tomorrow", v-model="enddate")

    div.form-inline

  div(v-if="status == 'searching'")
    div #[icon(name="spinner" pulse)] {{ $t('searching') }}

  div(v-if="events != null")
    hr

    aw-selectable-eventview(:events="events")

    div
      | {{ $t('searchEmpty') }}
      br
      | {{ $t('addWeek') }} #[b-button(size="sm" variant="outline-dark" @click="start = start.subtract(1, 'week'); search()") +1 week]

</template>

<style scoped lang="scss"></style>

<script>
import _ from 'lodash';
import moment from 'moment';
import { canonicalEvents } from '~/queries';

import 'vue-awesome/icons/search';
import 'vue-awesome/icons/spinner';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

export default {
  name: 'Search',
  data() {
    return {
      pattern: '',
      vis_method: 'eventlist',
      event_type: 'currentwindow',
      events: null,
      error: '',
      status: null,
      hostname: '',

      // Options
      show_options: false,
      use_regex: true,
      filter_afk: true,
      start: moment().subtract(1, 'day'),
      stop: moment().add(1, 'day'),
    };
  },
  mounted: async function () {
    await this.$store.dispatch('buckets/ensureBuckets');
    this.hostname = Object.keys(this.$store.getters['buckets/bucketsByHostname'])[0];
  },
  methods: {
    search: async function () {
      let query = canonicalEvents({
        bid_window: 'aw-watcher-window_' + this.hostname,
        bid_afk: 'aw-watcher-afk_' + this.hostname,
        filter_afk: this.filter_afk,
        classes: [[['searched'], { type: 'regex', regex: this.pattern }]],
        filter_classes: [['searched']],
      });
      query += '; RETURN = events;';

      const query_array = query.split(';').map(s => s.trim() + ';');
      const timeperiods = [this.start.format() + '/' + this.stop.format()];
      try {
        this.status = 'searching';
        const data = await this.$aw.query(timeperiods, query_array);
        this.events = _.orderBy(data[0], ['timestamp'], ['desc']);
        this.error = '';
      } catch (e) {
        console.error(e);
        this.error = e.response.data.message;
      } finally {
        this.status = null;
      }
    },
  },
};
</script>
