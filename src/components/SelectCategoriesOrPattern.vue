<template lang="pug">
div
  // Let the user either choose a mode to use for filtering events.
  // Either let the user choose which of the existing categories to include, or use a custom regex.
  b-form-group
    b-form-select(v-model="mode")
      option(value="custom") Custom regex
      option(value="categories") Use existing categories

  // select which categories, by having a form select and a "plus" button to include them
  b-input-group
    aw-select-categories(v-if="mode == 'categories'", v-model="filterCategoriesData")
    b-input(v-if="mode == 'custom'" v-model="pattern" v-on:keyup.enter="generate()" placeholder="Regex pattern to search for")
    b-input-group-append
      slot(name="input-group-append")
</template>

<script lang="ts">
import Vue from 'vue';
import { useCategoryStore } from '~/stores/categories';

const SEP = ' > ';

export default Vue.extend({
  name: 'SelectCategoriesOrPattern',
  props: {
    filterCategories: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      mode: 'categories',
      pattern: '',
      filterCategoriesData: [],
    };
  },
  computed: {
    categories: function () {
      return useCategoryStore().classes;
    },

    categoriesWithRules() {
      if (this.mode === 'categories') {
        // Get the category and all subcategories
        return this.categories
          .filter(cat => {
            const name = cat.name.join(SEP);
            for (const filterCat of this.filterCategoriesData) {
              if (name.includes(filterCat.join(SEP))) {
                return true;
              }
            }
            return false;
          })
          .filter(cat => cat.rule.type === 'regex')
          .map(cat => [cat.name, cat.rule]);
      } else if (this.mode === 'custom') {
        return [[['searched'], { type: 'regex', regex: this.pattern }]];
      } else {
        console.error('Unknown mode:', this.mode);
        return [];
      }
    },
  },
  watch: {
    filterCategories() {
      this.filterCategoriesData = [...this.filterCategoriesData, ...this.filterCategories];
    },
    filterCategoriesData() {
      this.$emit('input', this.categoriesWithRules);
      console.log(this.categoriesWithRules);
    },
    pattern() {
      this.$emit('input', this.categoriesWithRules);
      console.log(this.categoriesWithRules);
    },
  },
  async mounted() {
    await useCategoryStore().load();
  },
});
</script>
