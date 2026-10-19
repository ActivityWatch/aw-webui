import { AWClient } from 'aw-client';
import type { AxiosInstance } from 'axios';

import { useSettingsStore } from '~/stores/settings';

const API_TOKEN_QUERY_PARAM = 'token';
const API_TOKEN_STORAGE_KEY = 'aw-api-token';

let _client: AWClient | null;

function normalizeToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const trimmed = token.trim();
  return trimmed ? trimmed : null;
}

function getSessionStorage(): Storage | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  return sessionStorage;
}

export function getStoredApiToken(): string | null {
  return normalizeToken(getSessionStorage()?.getItem(API_TOKEN_STORAGE_KEY) ?? null);
}

export function getApiTokenFromLocation(currentLocation: Pick<Location, 'search'>): string | null {
  if (typeof URLSearchParams === 'undefined') {
    return null;
  }

  return normalizeToken(new URLSearchParams(currentLocation.search).get(API_TOKEN_QUERY_PARAM));
}

function persistApiToken(token: string): void {
  getSessionStorage()?.setItem(API_TOKEN_STORAGE_KEY, token);
}

export function stripApiTokenFromCurrentUrl(): void {
  if (typeof window === 'undefined' || typeof history === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has(API_TOKEN_QUERY_PARAM)) {
    return;
  }

  url.searchParams.delete(API_TOKEN_QUERY_PARAM);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl || '/');
}

// NOTE: The token is visible in window.location.href from page load until this
// function executes.  In the intended WebView/launcher environment no third-party
// scripts run, so the exposure window is acceptable.  For general browser use,
// consider passing the credential via the URL fragment instead of a query param.
export function loadApiTokenFromBrowser(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const urlToken = getApiTokenFromLocation(window.location);
  if (urlToken) {
    persistApiToken(urlToken);
    stripApiTokenFromCurrentUrl();
    return urlToken;
  }

  return getStoredApiToken();
}

export function applyApiToken(client: { req: AxiosInstance }, token: string | null): void {
  const defaults = client.req.defaults;
  const headers = (defaults.headers as Record<string, Record<string, unknown>>) || {};
  const commonHeaders = headers.common || {};

  if (token) {
    commonHeaders.Authorization = `Bearer ${token}`;
  } else {
    delete commonHeaders.Authorization;
  }

  headers.common = commonHeaders;
  defaults.headers = headers as typeof defaults.headers;
}

export function createClient(force?: boolean): AWClient {
  let baseURL = '';

  const production = typeof PRODUCTION !== 'undefined' && PRODUCTION;

  // If running with `npm node dev`, use testing server as origin.
  // Works since CORS is enabled by default when running `aw-server --testing`.
  if (!production) {
    const aw_server_url = typeof AW_SERVER_URL !== 'undefined' && AW_SERVER_URL;
    baseURL = aw_server_url || 'http://127.0.0.1:5666';
  }

  if (!_client || force) {
    _client = new AWClient('aw-webui', {
      testing: !production,
      baseURL,
    });
    applyApiToken(_client, loadApiTokenFromBrowser());
  } else {
    throw 'Tried to instantiate global AWClient twice!';
  }
  return _client;
}

export function configureClient(): void {
  const settings = useSettingsStore();
  _client.req.defaults.timeout = 1000 * settings.requestTimeout;
}

export function getClient(): AWClient {
  if (!_client) {
    throw 'Tried to get global AWClient before instantiating it!';
  }
  return _client;
}
