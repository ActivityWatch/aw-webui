<template lang="jade">
h2 Buckets

ul
  li(v-for="bucket in buckets")
    | Name: {{ bucket.name }}
    br
    | Events: {{ bucket.length }}

</template>

<script>
export default {
  name: "Buckets",
  data() {
    return {
      buckets: [
          {name: "test", length: 1337},
          {name: "another_test", length: 2},
          {name: "or_rather_a_mock", length: 100}
      ]
    }
  }
}
</script>
