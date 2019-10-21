import * as blockstack from 'blockstack';

const _state = {
  signedIn: false,
  profile: null,
};

const getters = {};

const actions = {
  loadSession: async function({ commit }, options) {
    console.log('load session');
    const session = new blockstack.UserSession();
    console.log(options);
    if (session.isUserSignedIn()) {
      console.log('signed in');
      const userData = blockstack.loadUserData();
      commit('signedIn', userData.profile);
    } else if (options && options.authResponse) {
      console.log('authresponse');
      const userData = await session.handlePendingSignIn(options.authResponse);
      commit('signedIn', userData.profile);
    }
  },
  signin: function() {
    const session = new blockstack.UserSession();
    const transitPrivateKey = session.generateAndStoreTransitKey();
    const appDomain = 'http://127.0.0.1:27180';
    const redirectURI = appDomain + '/#/dev';
    const manifestURI = appDomain + '/manifest.json';
    const scopes = ['publish_data'];
    const authRequest = session.makeAuthRequest(
      transitPrivateKey,
      redirectURI,
      manifestURI,
      scopes,
      appDomain
    );

    session.redirectToSignInWithAuthRequest(authRequest);
  },
  signout: function() {
    blockstack.signUserOut(window.location.origin);
  },
};

const mutations = {
  signedIn(state, profile) {
    const person = new blockstack.Person(profile);
    state.signedIn = true;
    state.profile = {
      name: person.name(),
      avatarUrl: person.avatarUrl(),
    };
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
