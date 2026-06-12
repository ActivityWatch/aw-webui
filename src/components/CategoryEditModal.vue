<template lang="pug">
// The category edit modal
b-modal(id="edit" ref="edit" :title="$t('categoryEdit.editTitle')" @show="resetModal" @hidden="hidden" @ok="handleOk")
  div.my-1
    b-input-group.my-1(:prepend="$t('categoryEdit.name')")
      b-form-input(v-model="editing.name")
    b-input-group(:prepend="$t('categoryEdit.parent')")
      b-select(v-model="editing.parent", :options="allCategories")
    //| ID: {{editing.id}}

  hr
  div.my-1
    b {{ $t('categoryEdit.rule') }}
    b-input-group.my-1(:prepend="$t('categoryEdit.type')")
      b-select(v-model="editing.rule.type", :options="allRuleTypes")
    div(v-if="editing.rule.type === 'regex'")
      b-input-group.my-1(:prepend="$t('categoryEdit.pattern')")
        b-form-input(v-model="editing.rule.regex")
      div.d-flex
        div.flex-grow-1
          b-form-checkbox(v-model="editing.rule.ignore_case" switch)
            | {{ $t('categoryEdit.caseInsensitive') }}
        div.flex-grow-1
          small.text-right
            div.text-danger(v-if="!validPattern") {{ $t('categoryEdit.invalidPattern') }}
            div.text-warning(v-if="validPattern && broad_pattern") {{ $t('categoryEdit.patternTooBroad') }}

  hr
  div.my-1
    b {{ $t('categoryEdit.color') }}

    b-form-checkbox(v-model="editing.inherit_color" switch)
      | {{ $t('categoryEdit.inheritParentColor') }}
    div.mt-1(v-show="!editing.inherit_color")
      color-picker(v-model="editing.color")

  hr
  div.my-1
    b {{ $t('categoryEdit.productivityScore') }}
    b-form-checkbox(v-model="editing.inherit_score" switch)
      | {{ $t('categoryEdit.inheritParentScore') }}
    b-input-group.my-1(:prepend="$t('categoryEdit.score')" v-if="!editing.inherit_score")
      b-form-input(v-model="editing.score")

  hr
  div.my-1
    b-btn(variant="danger", @click="removeClass(categoryId); $refs.edit.hide()")
      icon(name="trash")
      | {{ $t('categoryEdit.removeCategory') }}
</template>

<script lang="ts">
import _ from 'lodash';
import ColorPicker from '~/components/ColorPicker.vue';
import { useCategoryStore } from '~/stores/categories';
import { validateRegex, isRegexBroad } from '~/util/validate';

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
      },
    };
  },
  computed: {
    allCategories: function () {
      return [{ value: [], text: this.$t('categoryEdit.none') }].concat(
        this.categoryStore.allCategoriesSelect
      );
    },
    allRuleTypes: function () {
      return [
        { value: 'none', text: this.$t('categoryEdit.none') },
        { value: 'regex', text: this.$t('categoryEdit.regularExpression') },
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
      // FIXME
      return true;
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
      const new_class = {
        id: this.editing.id,
        name: this.editing.parent.concat(this.editing.name),
        rule: this.editing.rule.type !== 'none' ? this.editing.rule : { type: 'none' },
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
      this.editing = {
        id: cat.id,
        name: cat.subname,
        rule: _.cloneDeep(cat.rule),
        parent: cat.parent ? cat.parent : [],
        color,
        inherit_color,
        score,
        inherit_score,
      };
    },
  },
};
</script>
