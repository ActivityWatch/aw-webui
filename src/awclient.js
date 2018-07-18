const AWClient = require('../aw-client-js/out/aw-client').AWClient;

let origin = "";

// If running with `make dev`, use testing server as origin.
// Works since CORS is enabled by default when running `aw-server --testing`.
if(!PRODUCTION) {
    let protocol = "http";
    let hostname = "localhost";
    let port = "5666";
    origin = protocol + "://" + hostname + ":" + port;
}

let awc = new AWClient("aw-webui", !PRODUCTION, origin);

export default awc;
