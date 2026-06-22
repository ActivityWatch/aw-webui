<template lang="pug">
// The category edit modal
b-modal(id="edit" ref="edit" title="Edit category" @show="resetModal" @hidden="hidden" @ok="handleOk")
  div.my-1
    b-input-group.my-1(prepend="Name")
      b-form-input(v-model="editing.name")
    b-input-group(prepend="Parent")
      b-select(v-model="editing.parent", :options="allCategories")

  hr
  div.my-1
    b Rule
    b-input-group.my-1(prepend="Type")
      b-select(v-model="editing.rule.type", :options="allRuleTypes")
    div(v-if="editing.rule.type === 'regex'")
      // Multi-pattern list — each pattern is one line with its own remove button
      div.my-1(v-for="(pattern, index) in editing.rulePatterns" :key="index")
        b-input-group
          b-input-group-prepend
            span.input-group-text Pattern {{ index + 1 }}
          b-form-input(v-model="editing.rulePatterns[index]" @input="validateSinglePattern")
          b-input-group-append
            b-btn(variant="outline-danger" @click="removePattern(index)" :disabled="editing.rulePatterns.length <= 1")
              icon(name="trash")
      div.d-flex.align-items-center
        div.flex-grow-1
          b-btn.mt-1(size="sm" variant="outline-primary" @click="addPattern()")
            icon.mr-1(name="plus")
            | Add pattern
        div.flex-grow-1.text-right
          small.text-muted {{ editing.rulePatterns.length }} pattern(s)
      div.d-flex.mt-2
        div.flex-grow-1
          b-form-checkbox(v-model="editing.rule.ignore_case" switch)
            | Case insensitive
        div.flex-grow-1
          small.text-right
            div.text-danger(v-if="!validPattern") Invalid pattern(s)
            div.text-warning(v-if="validPattern && broad_pattern && !patternErrors.length") Pattern(s) too broad
            div.text-warning(v-if="patternErrors.length > 0")
              | Pattern(s) {{ patternErrors.join(', ') }} invalid

  hr
  div.my-1
    b Color
    b-form-checkbox(v-model="editing.inherit_color" switch)
      | Inherit parent color
    div.mt-1(v-show="!editing.inherit_color")
      color-picker(v-model="editing.color")

  hr
  div.my-1
    b Productivity score
    b-form-checkbox(v-model="editing.inherit_score" switch)
      | Inherit parent score
    b-input-group.my-1(prepend="Score" v-if="!editing.inherit_score")
      b-form-input(v-model="editing.score")

  hr
  div.my-1
    b-btn(variant="danger", @click="removeClass(categoryId); $refs.edit.hide()")
      icon(name="trash")
      | Remove category
</template>

<script lang="ts">
import _ from 'lodash';
import ColorPicker from '~/components/ColorPicker.vue';
import { useCategoryStore } from '~/stores/categories';
import { mapState } from 'pinia';
import {
  validateRegex,
  isRegexBroad,
  splitRegexPipe,
  joinRegexPipe,
} from '~/util/validate';

import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/plus';

export default {
  name: 'CategoryEditModal',
  components: {
    'color-picker': ColorPicker,
  },
  props: {
    categoryId: { type: Number, required: true },
  },
  data: function () {
    return {
      categoryStore: useCategoryStore(),

      editing: {
        id: 0,
        name: null,
        rule: {} as { type: string; regex?: string; ignore_case?: boolean },
        rulePatterns: [] as string[],  // UI-only: split view of rule.regex
        parent: [] as string[],
        inherit_color: true,
        color: null as string | null,
        inherit_score: true,
        score: null as number | null,
      },
      patternErrors: [] as number[],  // 1-based indices of invalid patterns
    };
  },
  computed: {
    ...mapState(useCategoryStore, {
      allCategories: state => [{ value: [], text: 'None' }].concat(state.allCategoriesSelect),
    }),
    allRuleTypes: function () {
      return [
        { value: 'none', text: 'None' },
        { value: 'regex', text: 'Regular Expression' },
      ];
    },
    valid: function () {
      return this.editing.rule.type !== 'none' && this.validPattern;
    },
    validPattern: function () {
      if (this.editing.rule.type !== 'regex') return true;
      const patterns = (this.editing.rulePatterns || [])
        .map(p => (p || '').trim())
        .filter(p => p.length > 0);
      if (patterns.length === 0) return false;
      return patterns.every(p => validateRegex(p));
    },
    broad_pattern: function () {
      if (this.editing.rule.type !== 'regex') return false;
      const patterns = (this.editing.rulePatterns || [])
        .map(p => (p || '').trim())
        .filter(p => p.length > 0);
      return patterns.some(p => isRegexBroad(p));
    },
  },
  watch: {
    categoryId: function (new_value) {
      if (new_value !== null) {
        this.showModal();
      }
    },
  },
  mounted: function () {
    if (this.categoryId !== null) {
      this.showModal();
    }
  },
  methods: {
    showModal() {
      this.$refs.edit.show();
    },
    hidden() {
      this.$emit('hidden');
    },
    removeClass() {
      this.categoryStore.removeClass(this.categoryId);
    },
    checkFormValidity() {
      return true;
    },
    handleOk(event) {
      event.preventDefault();
      this.handleSubmit();
      this.$emit('ok');
    },
    handleSubmit() {
      if (!this.checkFormValidity()) {
        return;
      }

      // Join multi-pattern list into a single pipe-separated regex string
      // so the backend receives the same format it always has.
      const regex = joinRegexPipe(this.editing.rulePatterns);

      const new_class = {
        id: this.editing.id,
        name: this.editing.parent.concat(this.editing.name),
        rule:
          this.editing.rule.type !== 'none'
            ? {
                type: 'regex',
                regex,
                ignore_case: this.editing.rule.ignore_case,
              }
            : { type: 'none' },
        data: {
          color: this.editing.inherit_color === true ? undefined : this.editing.color,
          score: this.editing.inherit_score === true ? undefined : this.editing.score,
        },
      };
      this.categoryStore.updateClass(new_class);

      this.$nextTick(() => {
        this.$refs.edit.hide();
      });
    },
    addPattern() {
      this.editing.rulePatterns.push('');
    },
    removePattern(index: number) {
      if (this.editing.rulePatterns.length <= 1) return;
      this.editing.rulePatterns.splice(index, 1);
      this.validateSinglePattern();
    },
    validateSinglePattern() {
      this.patternErrors = [];
      this.editing.rulePatterns.forEach((p, i) => {
        const trimmed = (p || '').trim();
        if (trimmed.length > 0 && !validateRegex(trimmed)) {
          this.patternErrors.push(i + 1);  // 1-based for user display
        }
      });
    },
    resetModal() {
      const cat = this.categoryStore.get_category_by_id(this.categoryId);
      const color = cat.data ? cat.data.color : undefined;
      const inherit_color = !color;
      const score = cat.data ? cat.data.score : undefined;
      const inherit_score = !score;
      this.editing = {
        id: cat.id,
        name: cat.subname,
        rule: _.cloneDeep(cat.rule),
        rulePatterns:
          cat.rule.type === 'regex' && cat.rule.regex
            ? splitRegexPipe(cat.rule.regex)
            : [''],
        parent: cat.parent ? cat.parent : [],
        color,
        inherit_color,
        score,
        inherit_score,
      };
      this.patternErrors = [];
    },
  },
};
</script>
