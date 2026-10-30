<template lang="pug">
// Based on https://bootstrap-vue.org/docs/components/form-tags#using-custom-form-components
b-form-tags#tags-component-select(
  v-model="selectedTags"
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
      template(v-slot:first="")
        // This is required to prevent bugs with Safari
        option(disabled value="") {{ $t('ui.selectCategories.chooseTag') }}
    ul.list-inline.d-inline-block.my-2(v-if="tags.length > 0")
      li.list-inline-item(v-for="tag in tags" :key="tag")
        b-form-tag(
          @remove="removeTag(tag)"
          :title="tagLabel(tag)"
          :disabled="disabled"
          variant="info"
        )
          | {{ tagLabel(tag) }}
</template>

<script lang="ts">
import Vue, { PropType } from 'vue';
import { useCategoryStore } from '~/stores/categories';

const SEP = ' > ';

export default Vue.extend({
  props: {
    value: {
      type: Array as PropType<string[][]>,
      default: () => [],
    },
  },
  computed: {
    // Bootstrap tags require strings; serialize paths, never their display labels.
    selectedTags: {
      get(): string[] {
        return this.value.map(path => JSON.stringify(path));
      },
      set(tags: string[]) {
        this.$emit(
          'input',
          tags.map(tag => JSON.parse(tag))
        );
      },
    },
    options() {
      return useCategoryStore().classes.map(category => ({
        value: JSON.stringify(category.name),
        text: category.name.join(SEP),
      }));
    },
  },
  methods: {
    tagLabel(tag: string): string {
      return JSON.parse(tag).join(SEP);
    },
  },
});
</script>
