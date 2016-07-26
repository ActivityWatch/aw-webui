import Vue from 'vue';

Vue.use(require('vue-resource'));

let protocol = "http";
let hostname = "localhost";
let port = "5600";
let origin = protocol + "://" + hostname + ":" + port;

let $Bucket = Vue.resource(origin + '/api/0/buckets{/id}');
let $Event = Vue.resource(origin + '/api/0/buckets/{id}/events');

export default {
  $Bucket: $Bucket,
  $Event: $Event,
};

