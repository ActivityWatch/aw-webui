<template lang="pug">
// The category edit modal
b-modal(id="edit" ref="edit" :title="$t('ui.categoryEditor.editTitle')" @show="resetModal" @hidden="hidden" @ok="handleOk" @keydown.native.enter="handleEnter" :ok-disabled="!canSubmit")
  div.my-1
    b-input-group.my-1(:prepend="$t('ui.categoryEditor.name')")
      b-form-input(v-model="editing.name")
    b-input-group(:prepend="$t('ui.categoryEditor.parent')")
      b-select(v-model="editing.parent", :options="allCategories")
    //| ID: {{editing.id}}

  hr
  div.my-1
    b {{ $t('ui.categoryEditor.rule') }}
    b-input-group.my-1(:prepend="$t('ui.categoryEditor.type')")
      b-select(v-model="editing.rule.type", :options="allRuleTypes")
    div(v-if="editing.rule.type === 'regex'")
      div.my-1(v-for="(pattern, index) in editing.rulePatterns" :key="index")
        b-input-group
          b-input-group-prepend
            span.input-group-text {{ $t('ui.categoryEditor.pattern') }} {{ index + 1 }}
          b-form-input(v-model="editing.rulePatterns[index]" :aria-label="$t('ui.categoryEditor.pattern') + ' ' + (index + 1)")
          b-input-group-append
            b-btn(variant="outline-danger" @click="removePattern(index)" :disabled="editing.rulePatterns.length <= 1" :aria-label="$t('ui.categoryEditor.removePattern', { number: index + 1 })")
              icon(name="trash")
      b-btn.mt-1(size="sm" variant="outline-primary" @click="addPattern()" :aria-label="$t('ui.categoryEditor.addPattern')")
        icon(name="plus")
      div.d-flex.mt-2
        div.flex-grow-1
          b-form-checkbox(v-model="editing.rule.ignore_case" switch)
            | {{ $t('ui.categoryEditor.caseInsensitive') }}
        div.flex-grow-1
          small.text-right
            div.text-danger(v-if="!validPattern") {{ $t('settings.activePattern.invalid') }}
            div.text-warning(v-if="validPattern && broad_pattern") {{ $t('settings.activePattern.tooBroad') }}
      div.mt-2
        small.text-muted {{ $t('ui.categoryEditor.matchFields') }}
        div.d-flex.flex-wrap
          b-form-checkbox.mr-3(
            v-for="key in fieldOptions"
            :key="key"
            v-model="editing.match_fields"
            :value="key"
          ) {{ key }}
        small.text-muted {{ $t('ui.categoryEditor.matchFieldsHelp') }}
      b-input-group.my-1(:prepend="$t('settings.categorization.priority')")
        b-form-input(
          v-model="editing.priority"
          type="number"
          min="0"
          step="1"
          :placeholder="$t('settings.categorization.priorityDefault')"
          :state="priorityState"
        )
      small.text-danger(v-if="!validPriority")
        | {{ $t('settings.categorization.priorityInteger') }}

  hr
  div.my-1
    b {{ $t('ui.categoryEditor.color') }}

    b-form-checkbox(v-model="editing.inherit_color" switch)
      | {{ $t('ui.categoryEditor.inheritColor') }}
    div.mt-1(v-show="!editing.inherit_color")
      color-picker(v-model="editing.color")

  hr
  div.my-1
    b {{ $t('ui.categoryEditor.productivityScore') }}
    b-form-checkbox(v-model="editing.inherit_score" switch)
      | {{ $t('ui.categoryEditor.inheritScore') }}
    b-input-group.my-1(:prepend="$t('ui.categoryEditor.score')" v-if="!editing.inherit_score")
      b-form-input(
        v-model="editing.score"
        :state="validScore ? null : false"
        :aria-describedby="validScore ? null : 'category-score-error-' + categoryId"
      )
    small.text-danger(
      v-if="!validScore"
      :id="'category-score-error-' + categoryId"
    )
      | {{ $t('ui.categoryEditor.invalidScore') }}

  hr
  div.my-1
    b-btn(variant="danger", @click="removeClass(categoryId); $refs.edit.hide()")
      icon(name="trash")
      | {{ $t('ui.categoryEditor.remove') }}
</template>

<script lang="ts">
import _ from 'lodash';
import ColorPicker from '~/components/ColorPicker.vue';
import { parseCategoryScore } from '~/util/categoryScore';
import { useCategoryStore } from '~/stores/categories';
import { validateRegex, isRegexBroad, splitRegexPipe, joinRegexPipe } from '~/util/validate';
import { CANONICAL_SELECT_KEYS, normalizeSelectKeys } from '~/util/classes';

import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/plus';

function samePatterns(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((p, i) => p === b[i]);
}

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
        id: 0, // Placeholder; replaced with the stored category id by resetModal()
        name: null,
        rule: {},
        rulePatterns: [] as string[],
        savedEmptyRows: [] as boolean[],
        originalRegex: '',
        parent: [],
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
        match_fields: [],
        priority: null,
      },
    };
  },
  computed: {
    allCategories() {
      return [
        { value: [], text: this.$t('ui.categoryEditor.none') },
        ...this.categoryStore.allCategoriesSelect,
      ];
    },
    allRuleTypes: function () {
      return [
        { value: 'none', text: this.$t('ui.categoryEditor.none') },
        { value: 'regex', text: this.$t('ui.categoryEditor.regularExpression') },
        //{ value: 'glob', text: 'Glob pattern' },
      ];
    },
    valid: function () {
      return this.canSubmit;
    },
    canSubmit: function () {
      if (!this.validScore) {
        return false;
      }
      if (this.editing.rule.type === 'regex') {
        return this.validPattern && this.validPriority;
      }
      return true;
    },
    validPattern: function () {
      if (this.editing.rule.type !== 'regex') return false;
      return validateRegex(this.storedRegex());
    },
    broad_pattern: function () {
      if (this.editing.rule.type !== 'regex') return false;
      return isRegexBroad(this.storedRegex());
    },
    validScore: function () {
      return this.editing.inherit_score || parseCategoryScore(this.editing.score) !== undefined;
    },
    validPriority: function () {
      if (this.editing.rule.type !== 'regex') {
        return true;
      }
      return this.priorityFromInput(this.editing.priority) !== undefined;
    },
    priorityState: function () {
      if (
        this.editing.priority === null ||
        this.editing.priority === undefined ||
        this.editing.priority === ''
      ) {
        return null;
      }
      return this.validPriority;
    },
    fieldOptions: function () {
      const extra = (this.editing.match_fields || []).filter(
        k => !(CANONICAL_SELECT_KEYS as readonly string[]).includes(k)
      );
      return [...CANONICAL_SELECT_KEYS, ...extra];
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
    storedRegex() {
      const patterns = this.editing.rulePatterns;
      if (Array.isArray(patterns) && patterns.length) {
        const original = this.editing.originalRegex || this.editing.rule.regex || '';
        // Only a row that was already an empty alternative in the saved rule
        // may stay empty. Cleared non-empty rows and new placeholders are omitted.
        const storedPatterns = patterns.filter(
          (pattern, index) => pattern !== '' || this.editing.savedEmptyRows?.[index]
        );
        if (samePatterns(storedPatterns, splitRegexPipe(original))) {
          return original;
        }
        return joinRegexPipe(storedPatterns);
      }
      return this.editing.rule.regex || '';
    },
    showModal() {
      this.$refs.edit?.show();
    },
    hidden() {
      this.$emit('hidden');
    },
    removeClass() {
      // TODO: Show a confirmation dialog
      // TODO: Remove children as well?
      this.categoryStore.removeClass(this.categoryId);
    },
    checkFormValidity() {
      if (!this.validScore) {
        return false;
      }
      if (this.editing.rule.type === 'regex' && !this.validPriority) {
        return false;
      }
      if (this.editing.rule.type === 'regex') {
        return this.validPattern;
      }
      return true;
    },
    handleEnter(event) {
      // Enter submits the modal, same as pressing OK (#232).
      // Skipped for elements where Enter already has a meaning of its own,
      // so we don't swallow their default behavior.
      const tag = event.target && event.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') {
        return;
      }
      // Mirrors the :ok-disabled condition on the modal
      if (!this.canSubmit) {
        return;
      }
      event.preventDefault();
      // `ok` means "the category was updated": a rejected submit keeps the
      // modal open and must not let the caller treat the draft as accepted.
      if (this.handleSubmit()) {
        this.$emit('ok');
      }
    },
    handleOk(event) {
      // Prevent modal from closing
      event.preventDefault();
      // Trigger submit handler
      if (this.handleSubmit()) {
        this.$emit('ok');
      }
    },
    handleSubmit(): boolean {
      // Exit when the form isn't valid
      if (!this.checkFormValidity()) {
        return false;
      }

      // Save the category
      // Guard against null/undefined/empty segments (e.g. when parent is "None"
      // and subname was never touched, or when a corrupted class was loaded).
      // Without this, [].concat(null) or [null].concat(x) writes `null` into
      // classes[].name, which the query engine then tries to resolve as the
      // variable `null` and throws QueryInterpretException, breaking all
      // charts that call categorize(). See #1355.
      const isValid = s => s !== null && s !== undefined && s !== '';
      const parent = Array.isArray(this.editing.parent) ? this.editing.parent.filter(isValid) : [];
      // The leaf name must be valid on its own — do NOT let a blank name
      // silently collapse a child into its parent's path.
      if (!isValid(this.editing.name)) {
        return false;
      }
      const nameSegments = parent.concat(this.editing.name);
      const rule =
        this.editing.rule.type !== 'none' ? _.cloneDeep(this.editing.rule) : { type: 'none' };
      if (rule.type === 'regex') {
        rule.regex = this.storedRegex();
        const selected = normalizeSelectKeys(this.editing.match_fields);
        if (!selected) {
          delete rule.select_keys;
        } else {
          rule.select_keys = selected;
        }
        const priority = this.priorityFromInput(this.editing.priority);
        delete rule.weight;
        if (priority === null) {
          delete rule.priority;
        } else {
          rule.priority = priority;
        }
      } else {
        delete rule.select_keys;
        delete rule.priority;
        delete rule.weight;
      }
      const new_class = {
        id: this.editing.id,
        name: nameSegments,
        rule,
        data: {
          color: this.editing.inherit_color === true ? undefined : this.editing.color,
          score:
            this.editing.inherit_score === true
              ? undefined
              : parseCategoryScore(this.editing.score),
        },
      };
      this.categoryStore.updateClass(new_class);

      // Hide the modal manually. Saving a rename or reparent re-renders the category
      // tree, which may destroy this component before the tick (activitywatch#1144).
      this.$nextTick(() => {
        this.$refs.edit?.hide();
      });
      return true;
    },
    addPattern() {
      this.editing.rulePatterns.push('');
      this.editing.savedEmptyRows.push(false);
    },
    removePattern(index: number) {
      if (this.editing.rulePatterns.length <= 1) return;
      this.editing.rulePatterns.splice(index, 1);
      this.editing.savedEmptyRows.splice(index, 1);
    },
    resetModal() {
      const cat = this.categoryStore.get_category_by_id(this.categoryId);
      const color = cat.data ? cat.data.color : undefined;
      const inherit_color = !color;
      const storedScore = cat.data?.score;
      // Show malformed legacy values for correction instead of silently inheriting.
      const score = parseCategoryScore(storedScore) ?? storedScore;
      const inherit_score = storedScore === null || storedScore === undefined;
      const rule = _.cloneDeep(cat.rule) || {};
      const storedKeys = normalizeSelectKeys(rule.select_keys);
      const originalRegex = rule.type === 'regex' ? rule.regex || '' : '';
      this.editing = {
        id: cat.id,
        name: cat.subname,
        rule,
        rulePatterns: originalRegex ? splitRegexPipe(originalRegex) : [''],
        savedEmptyRows: (originalRegex ? splitRegexPipe(originalRegex) : ['']).map(
          pattern => originalRegex !== '' && pattern === ''
        ),
        originalRegex,
        parent: cat.parent ? cat.parent : [],
        color,
        inherit_color,
        score,
        inherit_score,
        match_fields: storedKeys ? [...storedKeys] : [],
        priority: this.priorityFromRule(rule),
      };
    },
    priorityFromInput(value) {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      if (typeof value === 'string' && value.trim() === '') {
        return null;
      }
      const priority = Number(value);
      return Number.isInteger(priority) && priority >= 0 ? priority : undefined;
    },
    priorityFromRule(rule) {
      const value = rule.priority !== undefined ? rule.priority : rule.weight;
      return typeof value === 'number' && Number.isInteger(value) ? value : null;
    },
  },
};
</script>
