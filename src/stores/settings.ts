import { defineStore } from 'pinia';
import moment, { Moment } from 'moment';
import { getClient } from '~/util/awclient';

// Backoffs for NewReleaseNotification
export const SHORT_BACKOFF_PERIOD = 24 * 60 * 60;
export const LONG_BACKOFF_PERIOD = 5 * 24 * 60 * 60;

interface State {
  // Timestamp when user was first seen (first time webapp is run)
  initialTimestamp: Moment;

  startOfDay: string;
  startOfWeek: string;
  durationDefault: number;
  useColorFallback: boolean;
  landingpage: string;
  theme: 'light' | 'dark';

  newReleaseCheckData: Record<string, any>;
  userSatisfactionPollData: Record<string, any>;
  always_active_pattern: string;

  // Whether to show certain WIP features
  devmode: boolean;
  showYearly: boolean;
  useMultidevice: boolean;
  requestTimeout: number;

  // Set to true if settings loaded
  _loaded: boolean;
}

export const useSettingsStore = defineStore('settings', {
  state: (): State => ({
    initialTimestamp: moment(),

    startOfDay: '04:00',
    startOfWeek: 'Monday',
    durationDefault: 4 * 60 * 60,
    useColorFallback: false,
    landingpage: '/home',

    theme: 'light',

    newReleaseCheckData: {
      isEnabled: true,
      nextCheckTime: moment().add(SHORT_BACKOFF_PERIOD, 'seconds'),
      howOftenToCheck: SHORT_BACKOFF_PERIOD,
      timesChecked: 0,
    },
    userSatisfactionPollData: {},

    always_active_pattern: '',

    // Developer settings
    // NOTE: PRODUCTION might be undefined (in tests, for example)
    devmode: typeof PRODUCTION === 'undefined' ? true : !PRODUCTION,
    showYearly: false,
    useMultidevice: false,
    requestTimeout: 30,

    _loaded: false,
  }),

  getters: {
    loaded(state: State) {
      return state._loaded;
    },
  },

  actions: {
    async ensureLoaded() {
      if (!this.loaded) {
        await this.load();
      }
    },
    async load({ save }: { save?: boolean } = {}) {
      if (typeof localStorage === 'undefined') {
        console.error('localStorage is not supported');
        return;
      }
      const client = getClient();

      // Fetch from server, fall back to localStorage
      const server_settings = await client.get_settings();
      const all_keys = Object.assign({}, localStorage, server_settings);

      const storage = {};
      for (const key in all_keys) {
        // Skip built-in properties like length, setItem, etc.
        // Also skip keys starting with underscore, as they are local to the vuex store.
        if (Object.prototype.hasOwnProperty.call(localStorage, key) && !key.startsWith('_')) {
          // Fetch from server if not in localStorage
          const value = server_settings[key] || localStorage.getItem(key);
          const set_in_server = server_settings[key] !== undefined;
          //console.log(`${key}: ${value}`);

          // Keys ending with 'Data' are JSON-serialized objects
          if (key.includes('Data') && !set_in_server) {
            try {
              storage[key] = JSON.parse(value);
            } catch (e) {
              console.error('failed to parse', key, value);
            }
          } else if (value === 'true' || value === 'false') {
            storage[key] = value === 'true';
          } else {
            storage[key] = value;
          }
        }
      }
      this.$patch({ ...storage, _loaded: true });

      if (save) {
        await this.save();
      }
    },
    async save() {
      // Save to localStorage and backend
      // NOTE: localStorage deprecated, will be removed in future
      const client = getClient();
      for (const key of Object.keys(this.$state)) {
        const value = this.$state[key];
        if (typeof value === 'object') {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, value);
        }
        await client.req.post('/0/settings/' + key, value, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // After save, reload from localStorage
      await this.load({ save: false });
    },
    async update(new_state: Record<string, any>) {
      console.log('Updating state', new_state);
      this.$patch(new_state);
      await this.save();
    },
  },
});
