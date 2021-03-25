<template lang="pug">
div
  div.row.py-2.class
    div.col-8.col-md-4
      span(:style="{ marginLeft: (1.5 * depth) + 'em', cursor: _class.children.length > 0 ? 'pointer' : null}" @click="expanded = !expanded")
        span(v-if="_class.children.length > 0" style="opacity: 0.8")
          icon(:name="expanded ? 'regular/minus-square' : 'regular/plus-square'" scale="0.8")
        span(v-else style="opacity: 0.6")
          icon(name="circle" scale="0.4" style="margin-left: 1em; margin-right: 1.22em;")
        | {{ _class.name.slice(depth).join(" ➤ ")}}
        icon.ml-1(v-if="_class.data && _class.data.color" name="circle" :style="'color: ' + _class.data.color")
        span.ml-1(v-if="_class.children.length > 0" style="opacity: 0.5") ({{totalChildren}})

    div.col-4.col-md-8
      span.d-none.d-md-inline
        span(v-if="_class.rule.type === 'regex'") Rule ({{_class.rule.type}}): #[code {{_class.rule.regex}}]
        span(v-else, style="color: #888") No rule
      span.float-right
        b-btn.ml-1(size="sm", variant="outline-secondary", @click="showEditModal()" style="border: 0;" pill)
          icon(name="edit")
        b-btn.ml-1(size="sm", variant="outline-success", @click="addSubclass(_class); expanded = true" style="border: 0;" pill)
          icon(name="plus")
  div
    div.pa-2(v-for="child in _class.children", style="background: rgba(0, 0, 0, 0);", v-show="expanded")
      CategoryEditTree(:_class="child", :depth="depth+1")

  b-modal(id="edit" ref="edit" title="Edit category" @show="resetModal" @hidden="resetModal" @ok="handleOk")
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
      b-btn(variant="danger", @click="removeClass(_class); $refs.edit.hide()")
        icon(name="trash")
        | Remove category
</template>

<script>
import 'vue-awesome/icons/regular/plus-square';
import 'vue-awesome/icons/regular/minus-square';
import 'vue-awesome/icons/circle';
import 'vue-awesome/icons/caret-right';
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/edit';

import ColorPicker from '~/components/ColorPicker';

import _ from 'lodash';

export default {
  name: 'CategoryEditTree',
  components: {
    'color-picker': ColorPicker,
  },
  props: {
    _class: Object,
    depth: {
      type: Number,
      default: 0,
    },
  },
  data: function () {
    return {
      expanded: this.depth < 1,
      color_focused: false,
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
      const categories = this.$store.getters['categories/all_categories'];
      const entries = categories.map(c => {
        return { text: c.join('->'), value: c };
      });
      return [{ value: [], text: 'None' }].concat(entries);
    },
    allRuleTypes: function () {
      return [
        { value: null, text: 'None' },
        { value: 'regex', text: 'Regular Expression' },
        //{ value: 'glob', text: 'Glob pattern' },
      ];
    },
    totalChildren: function () {
      function countChildren(node) {
        return node.children.length + _.sum(_.map(node.children, countChildren));
      }
      return countChildren(this._class);
    },
  },
  methods: {
    addSubclass: function (parent) {
      this.$store.commit('categories/addClass', {
        name: parent.name.concat(['New class']),
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
      const new_class = {
        id: this.editing.id,
        name: this.editing.parent.concat(this.editing.name),
        rule: this.editing.rule.type !== null ? this.editing.rule : { type: null },
        data: { color: this.editing.inherit_color === true ? undefined : this.editing.color },
      };
      this.$store.commit('categories/updateClass', new_class);

      // Hide the modal manually
      this.$nextTick(() => {
        this.$refs.edit.hide();
      });
    },
    resetModal() {
      const color = this._class.data ? this._class.data.color : undefined;
      const inherit_color = !color;
      this.editing = {
        id: this._class.id,
        name: this._class.subname,
        rule: _.cloneDeep(this._class.rule),
        color,
        inherit_color,
        parent: this._class.parent ? this._class.parent : [],
      };
      //console.log(this.editing);
    },
  },
};
</script>

<style scoped lang="scss">
.row.class:hover {
  background-color: #eee;
  boder-radius: 5px;
}
</style>
