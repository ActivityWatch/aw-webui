<template lang="jade">
div#sidebar(v-bind:class="{ 'hide-labels': hideLabels }")
  ul
    li(@click="toggleLabels")
      span.glyphicon.glyphicon-menu-hamburger(style="text-align: center; width: 100%; font-size: 16pt; line-height: 50px")
    hr
    a(v-for="entry in entries" v-link="{ path: entry.path }")
      li
        span(class="{{ entry.iconCssClass }}")
        {{ entry.label }}

  //ul.bottom
  //  hr
  //  li
</template>

<script>
export default {
  props: {
    entries: Array,
    menutitle: String
  },
  data () {
    return {
      hideLabels: false
    }
  },
  methods: {
    toggleLabels: function () {
      console.log("labels toggeled");
      this.hideLabels = !this.hideLabels;
      console.log(this.hideLabels);
    }
  }
}
</script>

<style scoped lang="scss">
@import "../globalvars.scss";

$bgcolor: #333;

#sidebar {
    height: 100vh;
    background-color: #333;
    color: #999999;
    width: $sidebar_width;
    border-right: 1px solid #222;
    transition: width 1s ease;

    &.hide-labels {
      width: 48px;
    }
}

$icon_spacer: 15px;

ul {
    $bgcolor_highlight: #393939;
    $bordercolor_highlight: #444;

    width: 100%;
    list-style: none;
    padding-left: 0px;

    >hr {
      border-color: rgb(41, 41, 41);
      margin: 0px;
    }

    li {
        overflow: hidden;
        line-height: 40px;
        white-space: nowrap;

        &:hover {
            background-color: darken($bgcolor, 2%);
            color: #fff;
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
