import Vue from 'vue';

Vue.use(require('vue-resource'));


let origin = "";

// If running with `npm node dev`, use testing server as origin.
// Works since CORS is enabled by default when running `aw-server --testing`.
if(!PRODUCTION) {
    let protocol = "http";
    let hostname = "127.0.0.1";
    let port = "5666";
    origin = protocol + "://" + hostname + ":" + port;
}


let $Info       = Vue.resource(origin + '/api/0/info');
let $Bucket     = Vue.resource(origin + '/api/0/buckets/{id}?force=1');
let $Event      = Vue.resource(origin + '/api/0/buckets/{id}/events');
let $EventChunk = Vue.resource(origin + '/api/0/buckets/{id}/events/chunk?start={start}&end={end}');
let $Query      = Vue.resource(origin + '/api/0/query/?name={name}&start={start}&end={end}&cache={cache}');
let $Log        = Vue.resource(origin + '/api/0/log');

export default {
  $Info:        $Info,
  $Bucket:      $Bucket,
  $Event:       $Event,
  $EventChunk:  $EventChunk,
  $Query:       $Query,
  $Log:         $Log,
};

