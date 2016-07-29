<template lang="jade">
div#wrapper(v-bind:class="{ 'collapsed': collapsedSidebar }")
  div.sidebar-wrapper(v-bind:class="{ 'collapsed': collapsedSidebar }")
    sidemenu(:entries="menuEntries",
             menutitle="ActivityWatch")
             //:hideLabels="collapsedSidebar")
  div.pagecontent-wrapper
    div.header
      span.title
       | ActivityWatch
      usermenu
    div.container
      router-view
</template>

<script>
import Sidemenu from './components/Sidemenu.vue';
import Usermenu from './components/Usermenu.vue';
//import Home from './Home.vue';

export default {
  components: {
    Sidemenu,
    Usermenu,
//    Home
  },

  props: {
//    collapsedSidebar: Boolean,
  },

  data: function() {
    return {
      collapsedSidebar: false,
      menuEntries: [
        { label: "Home",
          path: "/",
          exact: true,
          iconCssClass: "glyphicon glyphicon-home" },
        { label: "Buckets",
          path: "/buckets",
          iconCssClass: "glyphicon glyphicon-th-list" }
      ]
    }
  },
  events: {
    'sidebar-collapsed': function(collapsed) {
      this.collapsedSidebar = collapsed;
    }
  }
}
</script>

<style lang="scss">
$bgcolor: #FFF;
$textcolor: #000;

$sidebar_width: 200px;
$sidebar_width_collapsed: 50px;

body {
    background-color: $bgcolor;
    color: $textcolor;
}

.header{
  background-color: #EEE;
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
    color: #444;
    margin-left: calc(50% - 200px + 100px);
  }
}


#wrapper {
    padding-left: $sidebar_width;
    transition: padding 1s ease;

    &.collapsed {
        padding-left: $sidebar_width_collapsed;
    }
}

.sidebar-wrapper {
    position: fixed;
    margin-left: -$sidebar_width;
    transition: margin 1s ease;
    font-family: 'Varela Round', sans-serif;
    font-size: 11pt;
    font-weight: 400;

    &.collapsed {
        margin-left: -$sidebar_width_collapsed;
    }
}

 .pagecontent-wrapper {
     padding: 0px;
 }
</style>
