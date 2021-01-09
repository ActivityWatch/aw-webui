<template lang="pug">
div
  div.row.py-2.class
    div.col-8.col-md-4
      span(:style="{ marginLeft: (2 * depth) + 'em'}")
        //| {{ _class.name.join(" ➤ ")}}
      | #[span(v-if="depth > 0") ⮡] {{ _class.name.slice(depth).join(" ➤ ")}}
    div.col-4.col-md-8
      //span.d-none.d-sm-inline.d-md-none(:style="{ marginLeft: (2 * depth) + 'em'}")
      span.d-none.d-md-inline
        span(v-if="_class.rule.type === 'regex'") Rule ({{_class.rule.type}}): #[code {{_class.rule.regex}}]
        span(v-else, style="color: #888") No rule
      span.float-right
        b-btn.ml-1(size="sm", variant="outline-secondary", @click="showEditModal()" style="border: 0;" pill)
          icon(name="edit")
        b-btn.ml-1(size="sm", variant="outline-success", @click="addSubclass(_class)" style="border: 0;" pill)
          icon(name="plus")
  div
    div.pa-2(v-for="child in _class.children", style="background: rgba(0, 0, 0, 0);", v-show="expanded")
      CategoryEditTree(:_class="child", :depth="depth+1")

  b-modal(id="edit" ref="edit" title="Edit category" @show="resetModal" @hidden="resetModal" @ok="handleOk")
    div.my-1
      b-input-group.my-1(prepend="Name")
        b-form-input(v-model="editing.name")
      b-input-group(prepend="Parent")
        b-select(v-model="editing.parentId", :options="allOtherCategories")

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
      b-btn(variant="danger", @click="removeClass(_class); $refs.edit.hide()")
        icon(name="trash")
        | Remove category
</template>

<script>
import 'vue-awesome/icons/plus-square';
import 'vue-awesome/icons/minus-square';
import 'vue-awesome/icons/caret-right';
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/edit';

import _ from 'lodash';

export default {
  name: 'CategoryEditTree',
  props: {
    _class: Object,
    depth: {
      type: Number,
      default: 0,
    },
  },
  data: () => {
    return {
      expanded: true,
      editing: {
        id: null,
        name: null,
        rule: {},
        parentId: null,
      },
    };
  },
  computed: {
    // This should be all nodes except one's children and oneself
    allOtherCategories: function () {
      const categories = this.$store.getters['categories/all_categories'];
      const entries = categories.map(c => {
        return { text: c.name.join('->'), value: c.id };
      });

      const findSubtree = this.$store.getters['categories/find_subtree'];
      const subtreeIds = findSubtree(this._class.id);

      return [{ value: -1, text: 'None' }].concat(
        entries.filter(c => !subtreeIds.includes(c.value))
      );
    },
    allRuleTypes: function () {
      return [
        { value: null, text: 'None' },
        { value: 'regex', text: 'Regular Expression' },
        //{ value: 'glob', text: 'Glob pattern' },
      ];
    },
  },
  methods: {
    addSubclass: function (parent) {
      this.$store.commit('categories/addClass', {
        name: parent.name.concat(['New class']),
        parentId: parent.id,
        rule: { type: 'regex', regex: 'FILL ME' },
      });
    },
    removeClass: function (_class) {
      // TODO: Show a confirmation dialog
      // TODO: Remove children as well?
      // TODO: Move button to edit modal?
      this.$store.commit('categories/removeClass', _class);
    },
    showEditModal() {
      this.$refs.edit.show();
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
      const getCategoryById = this.$store.getters['categories/get_category_by_id'];
      const parent_cat = getCategoryById(this.editing.parentId);

      const new_cat = {
        id: this.editing.id,
        parentId: this.editing.parentId,
        name: parent_cat ? parent_cat.name.concat(this.editing.name) : [this.editing.name],
        rule: this.editing.rule.type !== null ? this.editing.rule : { type: null },
        depth: parent_cat ? parent_cat.name.length + 1 : 0,
      };
      this.$store.commit('categories/updateClass', new_cat);

      // Hide the modal manually
      this.$nextTick(() => {
        this.$refs.edit.hide();
      });
    },
    resetModal() {
      this.editing = {
        id: this._class.id,
        name: this._class.subname,
        rule: _.cloneDeep(this._class.rule),
        parentId: this._class.parentId,
      };
    },
  },
};
</script>

<style scoped lang="scss">
.row.class:hover {
  background-color: #eee;
  border-radius: 5px;
}
</style>
