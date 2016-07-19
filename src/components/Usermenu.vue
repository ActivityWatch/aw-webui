<template lang="jade">
span#usermenu
  span(v-if="loggedIn")
    a(v-link="'/u/' + user.username")
      {{user.name}}
    a.logout(@click="logout")
      | Log out
  span(v-else)
    | Not logged in


</template>

<script>
export default {
  data: function () {
    return {
      'loggedIn': true,
      'user': {
        'name': 'Erik Bjäreholt',
        'username': 'erb'
      }
    }
  },
  methods: {
    logout: function() {
      console.log("Logging out");
      this.loggedIn = false;
      this.user = {};
    }
  }
}
</script>

<style scoped lang="scss">
#usermenu {
  float: right;


  span {
    a {
      margin-left: 20px;
    }
  }

}
</style>
