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
    div.container-fluid
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
      console.log("Event!");
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

  .title {
    margin: 0px;
    font-size: 20pt;
    text-align: center;
    color: #444;

    float: right;
    position: relative;
    left: -50%; /* or right 50% */
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

    &.collapsed {
        margin-left: -$sidebar_width_collapsed;
    }
}

 .pagecontent-wrapper {
     padding: 0px;
 }
</style>
