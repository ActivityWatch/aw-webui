import Vue from 'vue';

Vue.use(require('vue-resource'));

/*
let protocol = "http";
let hostname = "localhost";
let port = "5600";
//let port = "5666";
let origin = protocol + "://" + hostname + ":" + port;
 */
let origin = "";

let $Bucket = Vue.resource(origin + '/api/0/buckets{/id}');
let $Event  = Vue.resource(origin + '/api/0/buckets/{id}/events');
let $Log    = Vue.resource(origin + '/api/0/log');

export default {
  $Bucket:  $Bucket,
  $Event:   $Event,
  $Log:     $Log,
};

