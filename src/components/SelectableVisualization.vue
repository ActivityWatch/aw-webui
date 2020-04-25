<template lang="pug">
div
  h5 {{ type_title }}
  div(v-if="type == 'top_apps'")
    aw-summary(:fields="top_apps",
               :namefunc="e => e.data.app",
               :colorfunc="e => e.data.app",
               with_limit)
  div(v-if="type == 'top_titles'")
    aw-summary(:fields="top_titles",
               :namefunc="e => e.data.title",
               :colorfunc="e => e.data.app",
               with_limit)
  div(v-if="type == 'top_domains'")
    aw-summary(:fields="top_domains",
               :namefunc="e => e.data.$domain",
               :colorfunc="e => e.data.$domain",
               with_limit)
  div(v-if="type == 'top_urls'")
    aw-summary(:fields="top_urls",
               :namefunc="e => e.data.url",
               :colorfunc="e => e.data.$domain",
               with_limit)
  div(v-if="type == 'top_editor_files'")
    aw-summary(:fields="$store.state.activity_daily.editor.top_files",
               :namefunc="top_editor_files_namefunc",
               :colorfunc="e => e.data.language",
               with_limit)
  div(v-if="type == 'top_editor_languages'")
    aw-summary(:fields="$store.state.activity_daily.editor.top_languages",
               :namefunc="e => e.data.language",
               :colorfunc="e => e.data.language",
               with_limit)
  div(v-if="type == 'top_editor_projects'")
    aw-summary(:fields="$store.state.activity_daily.editor.top_projects",
               :namefunc="top_editor_projects_namefunc",
               :colorfunc="e => e.data.language",
               with_limit)
  div(v-if="type == 'top_categories'")
    aw-summary(:fields="top_categories",
               :namefunc="e => e.data['$category'].join(' > ')",
               :colorfunc="e => e.data['$category'].join(' > ')",
               with_limit)
  div(v-if="type == 'category_tree'")
    aw-categorytree(:events="top_categories")
  div(v-if="type == 'category_sunburst'")
    aw-sunburst-categories(:data="top_categories_hierarchy", style="height: 20em")

  b-dropdown.vis-style-dropdown-btn(size="sm" variant="outline-secondary")
    template(v-slot:button-content)
      icon(name="cog")
    b-dropdown-item(v-for="t in types" :key="t" variant="outline-secondary" @click="$emit('onTypeChange', id, t)" v-bind:disabled="!get_type_available(t)")
      | {{ get_type_title(t) }}
</template>

<style scoped lang="scss">
.vis-style-dropdown-btn {
  position: absolute;
  bottom: 0;
  right: 0.5em;

  background-color: #fff;
}
</style>

<script>
// TODO: Move this somewhere else
import { build_category_hierarchy } from '~/util/classes';
function pick_subname_as_name(c) {
  c.name = c.subname;
  c.children = c.children.map(pick_subname_as_name);
  return c;
}

export default {
  name: 'aw-selectable-vis',
  props: {
    id: Number,
    type: String,
  },
  data: function() {
    return {
      types: [
        'top_apps',
        'top_titles',
        'top_domains',
        'top_urls',
        'top_categories',
        'category_tree',
        'category_sunburst',
        'top_editor_files',
        'top_editor_languages',
        'top_editor_projects',
      ],
      // TODO: Move this function somewhere else
      top_editor_files_namefunc: e => {
        let f = e.data.file || '';
        f = f.split('/');
        f = f[f.length - 1];
        return f;
      },
      // TODO: Move this function somewhere else
      top_editor_projects_namefunc: e => {
        let f = e.data.project || '';
        f = f.split('/');
        f = f[f.length - 1];
        return f;
      },
    };
  },
  computed: {
    top_apps: function() {
      return this.$store.state.activity_daily.window.top_apps;
    },
    top_titles: function() {
      return this.$store.state.activity_daily.window.top_titles;
    },
    top_domains: function() {
      return this.$store.state.activity_daily.browser.top_domains;
    },
    top_urls: function() {
      return this.$store.state.activity_daily.browser.top_urls;
    },
    top_categories: function() {
      return this.$store.state.activity_daily.category.top;
    },
    top_categories_hierarchy: function() {
      if (this.top_categories) {
        const categories = this.top_categories.map(c => {
          return { name: c.data.$category, size: c.duration };
        });

        return {
          name: 'All',
          children: build_category_hierarchy(categories).map(c => pick_subname_as_name(c)),
        };
      } else {
        return null;
      }
    },
    type_title: function() {
      return this.get_type_title(this.type);
    },
  },
  methods: {
    get_type_available: function(type) {
      if (type === 'top_apps' || type === 'top_titles') {
        return this.$store.state.activity_daily.window.available;
      } else if (type === 'top_domains' || type === 'top_urls') {
        return this.$store.state.activity_daily.browser.available;
      } else if (
        type === 'top_editor_files' ||
        type === 'top_editor_languages' ||
        type === 'top_editor_projects'
      ) {
        return this.$store.state.activity_daily.editor.available;
      } else if (
        type === 'top_categories' ||
        type === 'category_tree' ||
        type === 'category_sunburst'
      ) {
        return this.$store.state.activity_daily.category.available;
      } else {
        console.error('Unknown type available: ', type);
        return false;
      }
    },
    get_type_title: function(type) {
      if (type === 'top_apps') {
        return 'Top Applications';
      } else if (type === 'top_titles') {
        return 'Top Window Titles';
      } else if (type === 'top_domains') {
        return 'Top Browser Domains';
      } else if (type === 'top_urls') {
        return 'Top Browser URLs';
      } else if (type === 'top_editor_files') {
        return 'Top Editor Files';
      } else if (type === 'top_editor_languages') {
        return 'Top Editor Languages';
      } else if (type === 'top_editor_projects') {
        return 'Top Editor Projects';
      } else if (type === 'top_categories') {
        return 'Top Categories';
      } else if (type === 'category_tree') {
        return 'Category Tree';
      } else if (type === 'category_sunburst') {
        return 'Category Sunburst';
      } else {
        console.error('Unknown type: ', type);
        return 'Unknown';
      }
    },
  },
};
</script>
