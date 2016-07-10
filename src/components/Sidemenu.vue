<template lang="jade">
div#sidebar
  ul.top
    li(class="title") {{ menutitle }}
    hr
    a(v-for="entry in entries" v-link="{ path: entry.path }")
      li
        span(class="{{ entry.iconCssClass }}" style="text-indent: 0; margin-right: 20px")
        {{ entry.label }}

  ul.bottom
    hr
    li
      span(class="glyphicon glyphicon-menu-hamburger" style="text-align: center")
</template>

<script>
export default {
  props: {
    entries: Array,
    menutitle: String
  },
  data () {
    return {
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
}

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

    &.top {
        text-indent: 20px;

        >li.title {
            text-indent: 20px;
            font-size: 24px;
            padding-top: 5px;
            padding-bottom: 8px;
            color: #ededed;

            &:hover {
                background-color: $bgcolor;
            }
        }
    }

    &.bottom {
        position: absolute;
        bottom: 0;
        text-align: center;
        margin-bottom: 0;
        background-color: $bgcolor;
    }
}

li {
    line-height: 40px;

    &:hover {
        background-color: darken($bgcolor, 2%);
        color: #fff;
        cursor: pointer;
    }
}

.title {
 }

a, a:focus {
    color: #999;
    text-decoration: none;
}
</style>
