import Vue from 'vue';

Vue.use(require('vue-resource'));

let $Bucket = Vue.resource('http://localhost:5666/api/0/buckets{/id}');
let $Event = Vue.resource('http://localhost:5666/api/0/buckets/{id}/events');

export default {
  $Bucket: $Bucket,
  $Event: $Event,
};

