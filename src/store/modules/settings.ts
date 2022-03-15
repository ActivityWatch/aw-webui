import moment, { Moment } from 'moment';
import NewReleaseNotification from '~/components/NewReleaseNotification.vue';

const SHORT_BACKOFF_PERIOD = NewReleaseNotification.SHORT_BACKOFF_PERIOD;

interface State {
  // Timestamp when user was first seen (first time webapp is run)
  initialTimestamp: Moment;

  startOfDay: string;
  durationDefault: number;
  useColorFallback: boolean;
  landingpage: string;

  // light or dark
  theme: string;

  newReleaseCheckData: Record<string, any>;
  userSatisfactionPollData: Record<string, any>;

  // Set to true if settings loaded
  _loaded: boolean;
}

// initial state, default settings
const _state: State = {
  initialTimestamp: moment(),
  startOfDay: '04:00',
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
  _loaded: false,
};

// getters
const getters = {
  loaded(state) {
    return state._loaded;
  },
};

// actions
const actions = {
  async ensureLoaded({ dispatch, getters }) {
    if (!getters.loaded) {
      await dispatch('load');
    }
  },
  async load({ commit }) {
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
        } else {
          storage[key] = value;
        }
      }
    }
    commit('setState', storage);

    // TODO: Then fetch from server
    //const getSettingsFromServer = async () => {
    //  const { data } = await this.$aw._get('/0/settings');
    //  return data;
    //};
  },
  async save({ state, dispatch }) {
    // First save to localStorage
    for (const key of Object.keys(state)) {
      const value = state[key];
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
    await dispatch('load');
  },
  async update({ commit, dispatch }, new_state: Record<string, any>) {
    console.log(`Updating state ${new_state}`);
    commit('setState', new_state);
    await dispatch('save');
  },
};

// mutations
const mutations = {
  setState(state: State, new_state: Record<string, any>) {
    for (const key of Object.keys(new_state)) {
      state[key] = new_state[key];
    }
    state._loaded = true;
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
