<template lang="jade">
sidemenu(:entries="menuEntries", menutitle="ActivityWatch")
</template>

<script>
import Sidemenu from './components/Sidemenu.vue';

export default {
  components: {
    Sidemenu
  },
  data: function() {
    return {
      menuEntries: [{label: "Home"},{ label: "Buckets"}]
    }
  }
}
</script>

<style>
</style>
