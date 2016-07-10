<template lang="jade">
div#wrapper
  div.sidebar-wrapper
    sidemenu(:entries="menuEntries", menutitle="ActivityWatch")
  div.pagecontent-wrapper
    div.container-fluid
      router-view
</template>

<script>
import Sidemenu from './components/Sidemenu.vue';
//import Home from './Home.vue';

export default {
  components: {
    Sidemenu,
//    Home
  },
  data: function() {
    return {
      menuEntries: [
        { label: "Home",
          path: "/",
          iconCssClass: "glyphicon glyphicon-home" },
        { label: "Buckets",
          path: "/buckets",
          iconCssClass: "glyphicon glyphicon-th-list" }
      ]
    }
  }
}
</script>

<style lang="scss">
 $bgcolor: #242832;
 $textcolor: #CCC;

 $sidebar_width: 200px;

 body {
   background-color: $bgcolor;
   color: #999;
 }


 #wrapper {
     padding-left: $sidebar_width;
 }

 .sidebar-wrapper {
    margin-left: -$sidebar_width;
    position: fixed;
 }

 .pagecontent-wrapper {
     padding: 1px;
 }
</style>
