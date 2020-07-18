<template lang="pug">
div
  h5 {{ visualizations[type].title }}
  div
    b-dropdown.vis-style-dropdown-btn(size="sm" variant="outline-secondary")
      template(v-slot:button-content)
        icon(name="cog")
      b-dropdown-item(v-for="t in types" :key="t" variant="outline-secondary" @click="$emit('onTypeChange', id, t)" v-bind:disabled="!visualizations[t].available")
        | {{ visualizations[t].title }}

  div(v-if="type == 'top_apps'")
    aw-summary(:fields="$store.state.activity.window.top_apps",
               :namefunc="e => e.data.app",
               :colorfunc="e => e.data.app",
               with_limit)
  div(v-if="type == 'top_titles'")
    aw-summary(:fields="$store.state.activity.window.top_titles",
               :namefunc="e => e.data.title",
               :colorfunc="e => e.data.app",
               with_limit)
  div(v-if="type == 'top_domains'")
    aw-summary(:fields="$store.state.activity.browser.top_domains",
               :namefunc="e => e.data.$domain",
               :colorfunc="e => e.data.$domain",
               with_limit)
  div(v-if="type == 'top_urls'")
    aw-summary(:fields="$store.state.activity.browser.top_urls",
               :namefunc="e => e.data.url",
               :colorfunc="e => e.data.$domain",
               with_limit)
  div(v-if="type == 'top_editor_files'")
    aw-summary(:fields="$store.state.activity.editor.top_files",
               :namefunc="top_editor_files_namefunc",
               :hoverfunc="top_editor_files_hoverfunc",
               :colorfunc="e => e.data.language",
               with_limit)
  div(v-if="type == 'top_editor_languages'")
    aw-summary(:fields="$store.state.activity.editor.top_languages",
               :namefunc="e => e.data.language",
               :colorfunc="e => e.data.language",
               with_limit)
  div(v-if="type == 'top_editor_projects'")
    aw-summary(:fields="$store.state.activity.editor.top_projects",
               :namefunc="top_editor_projects_namefunc",
               :hoverfunc="top_editor_projects_hoverfunc",
               :colorfunc="e => e.data.language",
               with_limit)
  div(v-if="type == 'top_categories'")
    aw-summary(:fields="$store.state.activity.category.top",
               :namefunc="e => e.data['$category'].join(' > ')",
               :colorfunc="e => e.data['$category'].join(' > ')",
               with_limit)
  div(v-if="type == 'category_tree'")
    aw-categorytree(:events="$store.state.activity.category.top")
  div(v-if="type == 'category_sunburst'")
    aw-sunburst-categories(:data="top_categories_hierarchy", style="height: 20em")

</template>

<style lang="scss">
.vis-style-dropdown-btn {
  position: absolute;
  top: 0.8em;
  right: 0.8em;

  > .btn {
    border: 0px;
  }
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
  data: function () {
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
      top_editor_files_hoverfunc: e => {
        return 'file: ' + e.data.file + '\n' + 'project: ' + e.data.project;
      },
      // TODO: Move this function somewhere else
      top_editor_projects_namefunc: e => {
        let f = e.data.project || '';
        f = f.split('/');
        f = f[f.length - 1];
        return f;
      },
      top_editor_projects_hoverfunc: e => e.data.project,
    };
  },
  computed: {
    visualizations: function () {
      return {
        top_apps: {
          title: 'Top Applications',
          available:
            this.$store.state.activity.window.available ||
            this.$store.state.activity.android.available,
        },
        top_titles: {
          title: 'Top Window Titles',
          available: this.$store.state.activity.window.available,
        },
        top_domains: {
          title: 'Top Browser Domains',
          available: this.$store.state.activity.browser.available,
        },
        top_urls: {
          title: 'Top Browser URLs',
          available: this.$store.state.activity.browser.available,
        },
        top_editor_files: {
          title: 'Top Editor Files',
          available: this.$store.state.activity.editor.available,
        },
        top_editor_languages: {
          title: 'Top Editor Languages',
          available: this.$store.state.activity.editor.available,
        },
        top_editor_projects: {
          title: 'Top Editor Projects',
          available: this.$store.state.activity.editor.available,
        },
        top_categories: {
          title: 'Top Categories',
          available: this.$store.state.activity.category.available,
        },
        category_tree: {
          title: 'Category Tree',
          available: this.$store.state.activity.category.available,
        },
        category_sunburst: {
          title: 'Category Sunburst',
          available: this.$store.state.activity.category.available,
        },
      };
    },
    top_categories_hierarchy: function () {
      const top_categories = this.$store.state.activity.category.top;
      if (top_categories) {
        const categories = top_categories.map(c => {
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
  },
};
</script>
