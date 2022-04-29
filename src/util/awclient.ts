import { AWClient } from 'aw-client';

let _client: AWClient | null;

export function createClient(): AWClient {
  let baseURL = '';

  // If running with `npm node dev`, use testing server as origin.
  // Works since CORS is enabled by default when running `aw-server --testing`.
  if (!PRODUCTION) {
    baseURL = AW_SERVER_URL || 'http://127.0.0.1:5666';
  }

  if (!_client) {
    _client = new AWClient('aw-webui', { testing: !PRODUCTION, baseURL });
  } else {
    throw 'Tried to instantiate global AWClient twice!';
  }
  return _client;
}

export function getClient(): AWClient {
  if (!_client) {
    throw 'Tried to get global AWClient before instantiating it!';
  }
  return _client;
}
