<template lang="jade">
h2 Buckets

div.pagination-header
  | Showing {{ buckets.length }}/{{buckets.length}} buckets

ul.bucket-list
  li(v-for="bucket in buckets")
    div.bucket
      div.title
        h4
          a(v-link="'/buckets/' + bucket.id")
            | {{ bucket.id }}
      div.metadata
        | Hostname: {{ bucket.hostname }}
        br
        | Client: {{ bucket.client }}
        br
        | # of events: Not implemented

</template>

<style lang="scss">
.bucket-list {
  list-style-type: none;
  padding: 0;
}

.bucket {
  border: 1px solid #555;
  border-radius: 3px;
  margin-bottom: 20px;

  .title {
    background-color: #eee;
    margin: 0;
    padding: 10px;
    border: 0 solid #555;
    border-width: 0 0 1px 0;

    h4 {
      margin: 0;
    }
  }

  .metadata {
    color: #333;
    padding: 10px;
  }
}
</style>

<script>
import Resources from './resources.js';
console.log(Resources);

let $Bucket = Resources.$Bucket;

export default {
  name: "Buckets",
  data: () => {
    return {
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
        console.log(response.json());
        this.$set('buckets', response.json())
      });
    },

    getBucketInfo: function(bucket_id) {
      $Bucket.get({"id": bucket_id}).then((response) => {
        console.log(response.json());
        this.buckets.$add(bucket_id, response.json())
      });
    }
  },
  ready: function() {
    this.getBuckets();
    this.getBucketInfo("test");
  }
}
</script>
