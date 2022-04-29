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
      b-input-group.my-1(prepend="Pattern")
        b-form-input(v-model="editing.rule.regex")
      b-form-checkbox(v-model="editing.rule.ignore_case" switch)
        | Ignore case

  hr
  div.my-1
    b Color

    b-form-checkbox(v-model="editing.inherit_color" switch)
      | Inherit parent color
    div.mt-1(v-show="!editing.inherit_color")
      color-picker(v-model="editing.color")

  //
    div.my-1
      b Productivity score
      b-input-group.my-1(prepend="Points")
        b-form-input(v-model="editing.productivity")

  hr
  div.my-1
    b-btn(variant="danger", @click="removeClass(categoryId); $refs.edit.hide()")
      icon(name="trash")
      | Remove category
</template>

<script>
import _ from 'lodash';
import ColorPicker from '~/components/ColorPicker';
import { useCategoryStore } from '~/stores/categories';

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
        id: 0, // FIXME: Use ID assigned to category in vuex store, in order for saves to be uniquely targeted
        name: null,
        rule: {},
        parent: [],
        inherit_color: true,
        color: null,
      },
    };
  },
  computed: {
    allCategories: function () {
      const categories = this.categoryStore.all_categories;
      const entries = categories.map(c => {
        return { text: c.join('->'), value: c };
      });
      return [{ value: [], text: 'None' }].concat(_.sortBy(entries, 'text'));
    },
    allRuleTypes: function () {
      return [
        { value: null, text: 'None' },
        { value: 'regex', text: 'Regular Expression' },
        //{ value: 'glob', text: 'Glob pattern' },
      ];
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
        rule: this.editing.rule.type !== null ? this.editing.rule : { type: null },
        data: { color: this.editing.inherit_color === true ? undefined : this.editing.color },
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
      this.editing = {
        id: cat.id,
        name: cat.subname,
        rule: _.cloneDeep(cat.rule),
        color,
        inherit_color,
        parent: cat.parent ? cat.parent : [],
      };
    },
  },
};
</script>
