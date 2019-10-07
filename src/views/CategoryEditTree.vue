<template lang="pug">
div
  div.row.my-2
    div.col-8.col-md-4
      span(:style="{ marginLeft: (2 * depth) + 'em'}")
        //| {{ cls.name.join(" ➤ ")}}
      | #[span(v-if="depth > 0") ➤] {{ cls.name.join(" ➤ ")}}
      //b-input-group.my-1
        b-form-input(v-model="cls.subname")
    div.col-4.col-md-8
      //span.d-none.d-sm-inline.d-md-none(:style="{ marginLeft: (2 * depth) + 'em'}")
      span.d-none.d-md-inline
        span(v-if="cls.rule.type == 'none' || !cls.rule.type", style="color: #888") No rule
        span(v-else, style="") Rule ({{cls.rule.type}}): #[code {{cls.rule.pattern}}]
      span.float-right
        b-btn.ml-1(size="sm", variant="outline-danger") #[icon(name="trash")]
        b-btn.ml-1(size="sm", variant="outline-secondary") #[icon(name="edit")]
        b-btn.ml-1(size="sm", variant="outline-success") #[icon(name="plus")]
      //b-input-group.my-1(prepend="Rule")
        b-select(v-model="cls.rule.type", :options="['none', 'regex', 'glob']")
        b-form-input(v-model="cls.rule.pattern")
        b-btn(@click="addSubclass(cls.name)") Add subcategory
  div
    div.pa-2(v-for="child in cls.children", style="background: rgba(0, 0, 0, 0);", v-show="expanded")
      CategoryEditTree(:cls="child", :depth="depth+1")
</template>

<script>
import 'vue-awesome/icons/plus-square';
import 'vue-awesome/icons/minus-square';
import 'vue-awesome/icons/caret-right';
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/edit';

export default {
  name: "CategoryEditTree",
  props: {
    cls: Object,
    depth: {
      type: Number,
      default: 0,
    }
  },
  data: () => {
      return { expanded: true };
  },
  methods: {
    // TODO: Move to vuex
    addSubclass: function(parent) {
      this.cls.children.push({name: "New class", rule: {type: "regex", pattern: "FILL ME"}, parent: parent})
    },
  }
}
</script>
