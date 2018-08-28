const AWClient = require('../aw-client-js/out/aw-client').AWClient;

let baseURL = "";

// If running with `npm node dev`, use testing server as origin.
// Works since CORS is enabled by default when running `aw-server --testing`.
if(!PRODUCTION) {
    let protocol = "http";
    let hostname = "127.0.0.1";
    let port = "5666";
    baseURL = protocol + "://" + hostname + ":" + port;
}

let awc = new AWClient("aw-webui", {testing: !PRODUCTION, baseURL});

export default awc;
