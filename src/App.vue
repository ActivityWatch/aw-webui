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
        { label: "Home", path: "/" },
        { label: "Buckets", path: "/buckets" }
      ]
    }
  }
}
</script>

<style>
 #wrapper {
     padding-left: 250px;
 }

 .sidebar-wrapper {
    margin-left: -250px;
    position: fixed;
 }

 .pagecontent-wrapper {
     padding: 1px;
 }
</style>
