<template lang="pug">
// The category edit modal
b-modal(id="edit" ref="edit" title="Edit category" @show="resetModal" @hidden="hidden" @ok="handleOk" @keydown.native.enter="handleEnter" :ok-disabled="editing.rule.type === 'regex' && !validPattern")
  div.my-1
    b-input-group.my-1(prepend="Name")
      b-form-input(v-model="editing.name")
    b-input-group(prepend="Parent")
      b-select(v-model="editing.parent", :options="allCategories")
    //| ID: {{editing.id}}

  hr
  div.my-1
    b Rule
    b-input-group.my-1(prepend="Type")
      b-select(v-model="editing.rule.type", :options="allRuleTypes")
    div(v-if="editing.rule.type === 'regex'")
      b-input-group.my-1(prepend="Pattern")
        b-form-input(v-model="editing.rule.regex")
      div.d-flex
        div.flex-grow-1
          b-form-checkbox(v-model="editing.rule.ignore_case" switch)
            | Case insensitive
        div.flex-grow-1
          small.text-right
            div.text-danger(v-if="!validPattern") Invalid pattern
            div.text-warning(v-if="validPattern && broad_pattern") Pattern too broad
      div.mt-2
        small.text-muted Match fields
        div.d-flex.flex-wrap
          b-form-checkbox.mr-3(
            v-for="key in fieldOptions"
            :key="key"
            v-model="editing.match_fields"
            :value="key"
          ) {{ key }}
        small.text-muted Leave all checked to match every string field (default).

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
import { validateRegex, isRegexBroad } from '~/util/validate';
import { CANONICAL_SELECT_KEYS, normalizeSelectKeys } from '~/util/classes';

import 'vue-awesome/icons/trash';

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
        id: 0, // FIXME: Use ID assigned to category in store, in order for saves to be uniquely targeted
        name: null,
        rule: {},
        parent: [],
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
        match_fields: [...CANONICAL_SELECT_KEYS],
      },
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
        //{ value: 'glob', text: 'Glob pattern' },
      ];
    },
    valid: function () {
      return this.editing.rule.type !== 'none' && this.validPattern;
    },
    validPattern: function () {
      return this.editing.rule.type === 'regex' && validateRegex(this.editing.rule.regex || '');
    },
    broad_pattern: function () {
      return this.editing.rule.type === 'regex' && isRegexBroad(this.editing.rule.regex || '');
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
    showModal() {
      this.$refs.edit.show();
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
      if (this.editing.rule.type === 'regex' && !this.validPattern) {
        return;
      }
      event.preventDefault();
      this.handleSubmit();
      this.$emit('ok');
    },
    handleOk(event) {
      // Prevent modal from closing
      event.preventDefault();
      // Trigger submit handler
      this.handleSubmit();
      this.$emit('ok');
    },
    handleSubmit() {
      // Exit when the form isn't valid
      if (!this.checkFormValidity()) {
        return;
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
        return;
      }
      const nameSegments = parent.concat(this.editing.name);
      const rule =
        this.editing.rule.type !== 'none' ? _.cloneDeep(this.editing.rule) : { type: 'none' };
      if (rule.type === 'regex') {
        const selected = normalizeSelectKeys(this.editing.match_fields);
        const allCanonical =
          selected &&
          selected.length === CANONICAL_SELECT_KEYS.length &&
          CANONICAL_SELECT_KEYS.every(k => selected.includes(k));
        if (!selected || allCanonical) {
          delete rule.select_keys;
        } else {
          rule.select_keys = selected;
        }
      } else {
        delete rule.select_keys;
      }
      const new_class = {
        id: this.editing.id,
        name: nameSegments,
        rule,
        data: {
          color: this.editing.inherit_color === true ? undefined : this.editing.color,
          score: this.editing.inherit_score === true ? undefined : this.editing.score,
        },
      };
      this.categoryStore.updateClass(new_class);

      // Hide the modal manually
      this.$nextTick(() => {
        this.$refs.edit.hide();
      });
    },
    resetModal() {
      const cat = this.categoryStore.get_category_by_id(this.categoryId);
      const color = cat.data ? cat.data.color : undefined;
      const inherit_color = !color;
      const score = cat.data ? cat.data.score : undefined;
      const inherit_score = !score;
      const rule = _.cloneDeep(cat.rule) || {};
      const storedKeys = normalizeSelectKeys(rule.select_keys);
      this.editing = {
        id: cat.id,
        name: cat.subname,
        rule,
        parent: cat.parent ? cat.parent : [],
        color,
        inherit_color,
        score,
        inherit_score,
        match_fields: storedKeys ? [...storedKeys] : [...CANONICAL_SELECT_KEYS],
      };
    },
  },
};
</script>
