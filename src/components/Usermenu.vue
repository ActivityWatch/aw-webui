<template lang="jade">
span#usermenu
  //ul.nav.nav-pills(role="tablist")
  //  li.active(role="presentation")
  //    a
  //      | Home
  //      span.badge 42
  //  li.active
  //    a Home
  //      span.badge 42

  span.label.label-success(style="margin-right: 20px;") Everything in order!

  span(v-if="loggedIn")
    a(v-link="'/u/' + user.username")
      div.profile-image(style="background-image: url('https://www.gravatar.com/avatar/{{ emailHash }}?size=36')")
      span.badge.active
        {{user.name}}
    a.logout(@click="logout")
      | Log out
  span(v-else)
    | Not logged in


</template>

<script>
import MD5 from 'crypto-js/md5';

export default {
  data: function () {
    return {
      'loggedIn': true,
      'emailHash': '',
      'user': {
        'name': 'Erik Bjäreholt',
        'username': 'erb',
        'email': 'erik@bjareho.lt'
      }
    }
  },
  methods: {
    logout: function() {
      console.log("Logging out");
      this.loggedIn = false;
      this.user = {};
    }
  },
  ready: function() {
    this.emailHash = MD5(this.user.email.trim().toLowerCase())
  }
}
</script>

<style scoped lang="scss">
#usermenu {
  float: right;
  margin-right: 20px;

  .profile-image {
    background-color: #444;
    display: inline-block;
    width: 38px;
    height: 38px;
    border: 1px solid #444;
    border-radius: 50%;
    position: relative;
    top: 14px;
    margin-top: -8px;
    margin-right: -15px;
  }

  span.badge {
    padding-left: 25px;
    font-size: 10pt;
  }

  span {
    a {
      margin-left: 20px;
    }
  }

}
</style>
