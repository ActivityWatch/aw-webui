<template lang="pug">
// Based on https://bootstrap-vue.org/docs/components/form-tags#using-custom-form-components
b-form-tags#tags-component-select(
  v-model="value"
  add-on-change
  no-outer-focus
)
  template(v-slot="{ tags, inputAttrs, inputHandlers, disabled, removeTag }")
    b-form-select(
      v-bind="inputAttrs"
      v-on="inputHandlers"
      :disabled="disabled || options.length === 0"
      :options="options"
    )
      template(#first)
        // This is required to prevent bugs with Safari
        option(disabled value="") Choose a tag...
    ul.list-inline.d-inline-block.my-2(v-if="tags.length > 0")
      li.list-inline-item(v-for="tag in tags" :key="tag")
        b-form-tag(
          @remove="removeTag(tag)"
          :title="tag"
          :disabled="disabled"
          variant="info"
        )
          | {{ tag }}
</template>

<script lang="typescript">
import Vue from 'vue';
import { useCategoryStore } from '~/stores/categories';

const SEP = " > ";

export default Vue.extend({
  data() {
    return {
      value: [],
    };
  },

  computed: {
    options() {
      const classes = useCategoryStore().classes;
      return classes.map(category => category.name.join(SEP));
    }
  },

  watch: {
    value(val) {
      const category_names = val.map(v => v.split(SEP))
      this.$emit('input', category_names);
    },
  },
});
</script>
