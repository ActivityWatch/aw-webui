interface State {
  info?: {
    hostname: string;
    device_id: string;
    version: string;
    testing: string;
  };
}

// initial state, default settings
const _state: State = {
  info: null,
};

// actions
const actions = {
  async getInfo({ commit }) {
    try {
      const info = await this._vm.$aw.getInfo();
      commit('setInfo', info);
    } catch (e) {
      console.error('Unable to connect: ', e);
    }
  },
};

// mutations
const mutations = {
  setInfo(state: State, info: any) {
    state.info = info;
  },
};

export default {
  namespaced: true,
  state: _state,
  actions,
  mutations,
};
