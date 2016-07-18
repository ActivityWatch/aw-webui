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
      $Bucket: this.$resource('/api/0/buckets{/id}'),
      buckets: [
          {name: "test", length: 1337},
          {name: "another_test", length: 2},
          {name: "or_rather_a_mock", length: 100}
      ],
    }
  },
  methods: {
    getBuckets: function() {
      $Bucket.get().then((response) => {
          this.$set('buckets', response.json())
        });
    },

    getBucketInfo: function(bucket_id) {
      $Bucket.get({"id": "bucket_id"}).then((response) => {
        this.$add('buckets', response.json())
      });
    }
  },
  ready: function() {
    this.getBuckets();
    this.getBucketInfo("test");
  }
}
</script>
