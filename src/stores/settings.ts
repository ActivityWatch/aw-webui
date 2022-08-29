import { defineStore } from 'pinia';
import moment, { Moment } from 'moment';

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
    async load() {
      if (typeof localStorage === 'undefined') {
        console.error('localStorage is not supported');
        return;
      }
      // Fetch from localStorage first, if exists
      const storage = {};
      for (const key in localStorage) {
        // Skip built-in properties like length, setItem, etc.
        // Also skip keys starting with underscore, as they are local to the vuex store.
        if (Object.prototype.hasOwnProperty.call(localStorage, key) && !key.startsWith('_')) {
          const value = localStorage.getItem(key);
          //console.log(`${key}: ${value}`);

          // Keys ending with 'Data' are JSON-serialized objects
          if (key.includes('Data')) {
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

      // TODO: Then fetch from server
      //const getSettingsFromServer = async () => {
      //  const { data } = await this.$aw._get('/0/settings');
      //  return data;
      //};
    },
    async save() {
      // First save to localStorage
      for (const key of Object.keys(this.$state)) {
        const value = this.$state[key];
        if (typeof value === 'object') {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, value);
        }
      }

      // TODO: Save to backend
      //const updateSettingOnServer = async (key: string, value: string) => {
      //  console.log({ key, value });
      //  const headers = { 'Content-Type': 'application/json' };
      //  const { data } = await this.$aw._post('/0/settings', { key, value }, headers);
      //  return data;
      //};

      // After save, reload from localStorage
      await this.load();
    },
    async update(new_state: Record<string, any>) {
      console.log('Updating state', new_state);
      this.$patch(new_state);
      await this.save();
    },
  },
});
