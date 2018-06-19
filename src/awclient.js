const { AWClient } = require('../aw-client-js/out/aw-client');

let origin = '';

// If running with `npm node dev`, use testing server as origin.
// Works since CORS is enabled by default when running `aw-server --testing`.
if (!PRODUCTION) {
  const protocol = 'http';
  const hostname = 'localhost';
  const port = '5666';
  origin = `${protocol}://${hostname}:${port}`;
}

const awc = new AWClient('aw-webui', !PRODUCTION, origin);

export default awc;
