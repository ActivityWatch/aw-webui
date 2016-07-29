<template lang="jade">
div#sidebar(v-bind:class="{ 'collapsed': collapsed }")
  ul
    li(@click="toggleLabels")
      span.toggle-menu.glyphicon.glyphicon-menu-hamburger
    hr
    a(v-for="entry in entries", v-link="{ path: entry.path, exact: entry.exact }")
      li
        tooltip(v-if="collapsed", trigger="hover", effect="fadein", placement="right", :content="entry.label")
          span(class="menuicon {{ entry.iconCssClass }}")
        span(v-else, class="menuicon {{ entry.iconCssClass }}")
        {{ entry.label }}

  //ul.bottom
  //  hr
  //  li
</template>

<script>
var tooltip = require('vue-strap').tooltip;

export default {
  props: {
    entries: Array,
    collapsed: Boolean
  },
  components: {
    'tooltip': tooltip
  },
  data: function () {
          return {};
        },
  methods: {
    toggleLabels: function () {
      this.collapsed = !this.collapsed;
      this.$dispatch("sidebar-collapsed", this.collapsed);
    }
  }
}
</script>

<style scoped lang="scss">
@import "../style/globalvars.scss";

$bgcolor: #333;

#sidebar {
    height: 100vh;
    background-color: #333;
    color: #999999;
    width: $sidebar_width;
    border-right: 1px solid #222;
    transition: width 1s ease;

    &.collapsed {
      width: 48px;
    }
}

$icon_spacer: 15px;


ul {
    $bgcolor_highlight: #393939;
    $bordercolor_highlight: #444;
    $menubutton_color: #2e2e2e;
    $item_hover_color: #222;
    $item_active_color: #252525;

    width: 100%;
    list-style: none;
    padding-left: 0px;

    >hr {
      border-color: rgb(41, 41, 41);
      margin: 0px;
    }

    a.v-link-active > li {
      background-color: $item_active_color;
      color: #ddd;
    }

    li {
        overflow: hidden;
        line-height: 40px;
        white-space: nowrap;

        .menuicon {
            padding-top: 15px;
            padding-bottom: 15px;
        }

        span.toggle-menu {
            text-align: center;
            width: 100%;
            font-size: 16pt;
            line-height: 50px;
            margin-left: -2px;
            background-color: $menubutton_color;
            border-color: #0F0;

            &:hover {
              background-color: $item_hover_color;
            }
        }

        &:hover {
            background-color: $item_hover_color !important;
            color: #fff !important;
            cursor: pointer;
        }
    }

    .glyphicon {
      font-size: 10pt;
      padding-left: 2px + $icon_spacer;
      padding-right: 2px + $icon_spacer;
    }

    &.bottom {
        position: absolute;
        bottom: 0;
        text-align: center;
        margin-bottom: 0;
        background-color: $bgcolor;
    }
}

a, a:focus {
    color: #999;
    text-decoration: none;
}
</style>
