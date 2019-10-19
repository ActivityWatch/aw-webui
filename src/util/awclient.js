const AWClient = require('../../aw-client-js').AWClient;

let baseURL = "";

// If running with `npm node dev`, use testing server as origin.
// Works since CORS is enabled by default when running `aw-server --testing`.
if(!PRODUCTION) {
    const protocol = "http";
    const hostname = "127.0.0.1";
    const port = "5666";
    baseURL = protocol + "://" + hostname + ":" + port;
}

const awc = new AWClient("aw-webui", {testing: !PRODUCTION, baseURL});

export default awc;
