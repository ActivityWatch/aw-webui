import { AWClient } from 'aw-client';

let baseURL = '';

// If running with `npm node dev`, use testing server as origin.
// Works since CORS is enabled by default when running `aw-server --testing`.
if (!PRODUCTION) {
  if (AW_CLIENT_URL) {
    baseURL = AW_CLIENT_URL;
  } else {
    baseURL = 'http://127.0.0.1:5666';
  }
}

const awc = new AWClient('aw-webui', { testing: !PRODUCTION, baseURL });

export default awc;
