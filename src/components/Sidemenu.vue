<template lang="jade">
ul
  li(class="title") {{ menutitle }}
  a(v-for="entry in entries" v-link="{ path: entry.path }") 
    li
      {{ entry.label }}
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

<style scoped>
 ul {
     color: #999999;
     width: 250px;
     list-style: none;
     padding-left: 0px;
     height: 100vh;
     background-color: #333;
 }
 li {
     text-indent: 20px;
     line-height: 40px;
     background-color: #333;
 }
 li:hover {
    background-color: #999999;
    color: #fff;
    cursor: pointer;
 }
 .title {
     font-size: 24px;
     padding-top: 20px;
     padding-bottom: 10px;
     color: #ededed;
 }
 .title:hover {
     background-color: #333;
 }

 a, a:focus {
     color: #999;
     text-decoration: none;
 }
</style>
