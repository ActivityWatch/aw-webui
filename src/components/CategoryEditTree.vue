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
        b-btn.ml-1.border-0(size="sm", variant="outline-secondary", @click="showEditModal(_class.id)" pill)
          icon(name="edit")
        b-btn.ml-1.border-0(size="sm", variant="outline-success", @click="addSubclass(_class); expanded = true" pill)
          icon(name="plus")
  div
    div.pa-2(v-for="child in _class.children", style="background: rgba(0, 0, 0, 0);", v-show="expanded")
      CategoryEditTree(:_class="child", :depth="depth+1")

  div(v-if="editingId !== null")
    CategoryEditModal(:categoryId='editingId', @hidden="hideEditModal()")
</template>

<script>
import 'vue-awesome/icons/regular/plus-square';
import 'vue-awesome/icons/regular/minus-square';
import 'vue-awesome/icons/circle';
import 'vue-awesome/icons/caret-right';
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/edit';

import CategoryEditModal from './CategoryEditModal.vue';
import { useCategoryStore } from '~/stores/categories';

import _ from 'lodash';

export default {
  name: 'CategoryEditTree',
  components: {
    CategoryEditModal: CategoryEditModal,
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
      categoryStore: useCategoryStore(),

      expanded: this.depth < 1,
      editingId: null,
    };
  },
  computed: {
    totalChildren: function () {
      function countChildren(node) {
        return node.children.length + _.sum(_.map(node.children, countChildren));
      }
      return countChildren(this._class);
    },
  },
  methods: {
    addSubclass: function (parent) {
      this.categoryStore.addClass({
        name: parent.name.concat(['New class']),
        rule: { type: 'regex', regex: 'FILL ME' },
      });

      // Find the category with the max ID, and open an editor for it
      const lastId = _.max(_.map(this.categoryStore.classes, 'id'));
      this.editingId = lastId;
    },
    showEditModal: function () {
      this.editingId = this._class.id;
    },
    hideEditModal: function () {
      this.editingId = null;
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
