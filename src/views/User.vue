<template lang="jade">
h2 {{user.name}} ({{ user.username }})

div
| {{ user.email }}

p
| Some text about user should go here

</template>

<style lang="scss">
</style>

<script>
export default {
  name: "User",
  data: () => {
    return {
      user: {
          name: "Erik Bjäreholt",
          username: "erb",
          email: "erik@bjareho.lt"
      }
    }
  },
  methods: {
  },
  ready: function() {
      let username = this.$route.params.username;
      // Fetch user by username
  }
}
</script>
