<template lang="jade">
div#wrapper
  div.header
    div.container
      span.title
       | ActivityWatch
      //usermenu
  div.container.aw-container
    nav.row.navbar.aw-navbar
      ul.nav.navbar-nav
        li(v-for="entry in menuEntries")
          a(v-link="{ path: entry.path, exact: entry.exact }")
            span(class="menuicon {{ entry.iconCssClass }}")
            | {{ entry.label }}
    div
      router-view
</template>

<script>
import Usermenu from './components/Usermenu.vue';

export default {
  components: {
    Usermenu,
  },

  props: {
  },

  data: function() {
    return {
      menuEntries: [
        { label: "Home",
          path: "/",
          exact: true,
          iconCssClass: "glyphicon glyphicon-home" },
        { label: "Activity",
          path: "/activity",
          iconCssClass: "glyphicon glyphicon-time" },
        { label: "Buckets",
          path: "/buckets",
          iconCssClass: "glyphicon glyphicon-folder-open" },
        { label: "Server Log",
          path: "/log",
          iconCssClass: "glyphicon glyphicon-list-alt" }
      ]
    }
  },
}
</script>

<style lang="scss">
$bgcolor: #FFF;
$textcolor: #000;

$topbar_height: 50px;
$sidebar_width: 200px;
$sidebar_width_collapsed: 50px;

body {
  color: $textcolor;
  font-family: 'Varela Round', sans-serif;
  background-color: #EEE;
}

.aw-navbar {
    border: 0px solid #DDD;
    border-bottom-width: 1px;
    min-height: 20px;

    li > a {
        padding: 10px 15px 10px 15px;
        color: #555;

        span {
            margin-right: 7px;
        }
    }
}


.header{
  border-bottom: 1px solid #CCC;
  height: 50px;
  line-height: 50px;
  font-family: 'Varela Round', sans-serif;
  font-size: 12pt;
  font-weight: 400;

  .title {
    display: inline-block;
    width: 200px;
    font-size: 20pt;
    text-align: center;
    width: 100%;
    color: #444;
  }
}

.aw-container {
  background-color: #FFF;
  border: 1px solid #CCC;
  border-top: 0px;
  border-radius: 0px 0px 5px 5px;
}
</style>
