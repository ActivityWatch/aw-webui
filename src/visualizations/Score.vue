<template lang="pug">
div
  div.text-center.position-relative
    button.score__help-btn(
      id="scoreHelp"
      type="button"
      aria-label="How is the score calculated?"
    )
      icon(name="question-circle" scale="0.9")
    b-tooltip(target="scoreHelp" placement="left" triggers="hover focus")
      | Sum of (hours &times; category score). Set category scores in #[b Settings &gt; Categories]. Positive scores reward activities you want to do more of; negative ones penalize distractions.
    div.small.text-muted Score for {{ score_period_label }}
    div.score-value(:class="score >= 0 ? 'text-success' : 'text-danger'")
      | {{score >= 0 ? '+' : ''}}{{ (Math.round(score * 10) / 10).toFixed(1) }}
    div.small.text-muted(v-if="!isNaN(score_productive_percent)")
      | {{score_productive_percent.toFixed(1)}}% productive
  hr
  div
    b Top productive
    div.mt-2(v-for="cat in top_productive" :key="cat.data.$category.join('>')")
      div.d-flex.align-items-center
        div
          div {{cat.data.$category.slice(-1)[0]}}
          div.small.text-muted(v-if="cat.data.$category.length > 1")
            | {{cat.data.$category.slice(0, -1).join(" > ")}}
        div.ml-auto.text-success.h5.mb-0
          | +{{ (Math.round(cat.data.$total_score * 10) / 10).toFixed(1) }}
    p.text-muted.small.mb-0.mt-2(v-if="top_productive.length === 0")
      | No productive categories recorded yet.
  hr
  div
    b Top distracting
    div.mt-2(v-for="cat in top_distracting" :key="cat.data.$category.join('>')")
      div.d-flex.align-items-center
        div
          div {{cat.data.$category.slice(-1)[0]}}
          div.small.text-muted(v-if="cat.data.$category.length > 1")
            | {{cat.data.$category.slice(0, -1).join(" > ")}}
        div.ml-auto.text-danger.h5.mb-0
          | {{ (Math.round(cat.data.$total_score * 10) / 10).toFixed(1) }}
    p.text-muted.small.mb-0.mt-2(v-if="top_distracting.length === 0")
      | No distracting activity in this period.
</template>

<style scoped>
.score-value {
  font-size: 2em;
  font-weight: 600;
  line-height: 1.1;
}

.score__help-btn {
  position: absolute;
  top: 0;
  right: 0;
  background: transparent;
  border: 0;
  padding: 0.25rem;
  color: inherit;
  opacity: 0.45;
  cursor: help;
  line-height: 1;
}

.score__help-btn:hover,
.score__help-btn:focus {
  opacity: 0.85;
  outline: none;
}
</style>

<script lang="ts">
import _ from 'lodash';
import 'vue-awesome/icons/question-circle';
import { useActivityStore } from '~/stores/activity';
import { IEvent } from '~/util/interfaces';
import { periodReadable } from '~/util/timeperiod';

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
    score_period_label: function (): string {
      const timeperiod = useActivityStore().query_options?.timeperiod;
      return timeperiod ? periodReadable(timeperiod) : 'selected period';
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
