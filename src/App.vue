<template lang="jade">
div#wrapper
  div.sidebar-wrapper
    sidemenu(:entries="menuEntries", menutitle="ActivityWatch")
  div.pagecontent-wrapper
    div.header_title(style="text-align: center") ActivityWatch
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
 $bgcolor: #FFF;
 $textcolor: #000;

 $sidebar_width: 200px;

 body {
   background-color: $bgcolor;
   color: $textcolor;
 }

 .header_title {
    font-size: 20pt;
    line-height: 50px;
    text-align: center;
    background-color: #EEE;
    color: #444;
    border-bottom: 1px solid #CCC;
 }


 #wrapper {
     padding-left: $sidebar_width;
 }

 .sidebar-wrapper {
    margin-left: -$sidebar_width;
    position: fixed;
 }

 .pagecontent-wrapper {
     padding: 0px;
 }
</style>
