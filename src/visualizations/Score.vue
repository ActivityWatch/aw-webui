<template lang="pug">
div
  div(style="text-align: center")
    | Your total score today is:
    div(:style="'font-size: 2em; color: ' + (score >= 0 ? '#0A0' : '#F00')")
      | {{score >= 0 ? '+' : ''}}{{ (Math.round(score * 10) / 10).toFixed(1) }}
    div.small.text-muted
      | ({{score_productive_percent.toFixed(1)}}% productive)
  hr
  div
    b Top productive:
    div.mt-2(v-for="cat in top_productive")
      div.d-flex
        div
          div
            | {{cat.data.$category.slice(-1)[0]}}
          div(style="font-size: 0.7em; color: #666;")
            | {{cat.data.$category.slice(0, -1).join(" > ")}}
        div.ml-auto
          span(style="font-size: 1.2em; color: #0A0")
            | +{{ (Math.round(cat.data.$total_score * 10) / 10).toFixed(1) }}
  hr
  div
    b Top distracting:
    div.mt-2(v-for="cat in top_distracting")
      div.d-flex
        div
          div
            | {{cat.data.$category.slice(-1)[0]}}
          div(style="font-size: 0.7em; color: #666;")
            | {{cat.data.$category.slice(0, -1).join(" > ")}}
        div.ml-auto
          span(style="font-size: 1.2em; color: #F00")
            | {{ (Math.round(cat.data.$total_score * 10) / 10).toFixed(1) }}
</template>

<script lang="ts">
import _ from 'lodash';
import { useActivityStore } from '~/stores/activity';
import { IEvent } from '~/util/interfaces';

// TODO: Maybe add a "Category Tree"-style visualization?

export default {
  name: 'aw-score',
  computed: {
    categories_with_score: function (): IEvent[] {
      // FIXME: Does this get all category time? Or just top ones?
      const top_categories = useActivityStore().category.top;
      return _.map(top_categories, cat => {
        cat.data.$total_score = (cat.duration / (60 * 60)) * cat.data.$score;
        return cat;
      });
    },
    score: function (): number {
      return _.sum(_.map(this.categories_with_score, cat => cat.data.$total_score));
    },
    score_productive_percent() {
      // Compute the percentage of time spent on productive activities (score > 0)
      const total_time = _.sumBy(this.categories_with_score as IEvent[], cat => cat.duration);
      const productive_time = _.sumBy(
        _.filter(this.categories_with_score, cat => cat.data.$total_score > 0),
        cat => cat.duration
      );
      return (productive_time / total_time) * 100;
    },
    top_productive: function () {
      return _.sortBy(
        _.filter(this.categories_with_score, cat => cat.data.$total_score > 0.1),
        c => -c.data.$total_score
      );
    },
    top_distracting: function () {
      return _.sortBy(
        _.filter(this.categories_with_score, cat => cat.data.$total_score < -0.1),
        c => c.data.$total_score
      );
    },
  },
};
</script>
