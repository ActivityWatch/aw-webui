import * as blockstack from 'blockstack';
import { ZstdCodec } from 'zstd-codec';

const enc = new TextEncoder();
const dec = new TextDecoder();

async function compress(data) {
  console.log('compress arg:', data);
  return new Promise((resolve, reject) => {
    ZstdCodec.run(zstd => {
      const simple = new zstd.Simple();
      data = enc.encode(data);
      const compressed = simple.compress(data);
      const compression_ratio = compressed.byteLength / data.byteLength;
      console.log(
        `compressed ${data.byteLength} into ${compressed.byteLength} (${compression_ratio})`
      );
      resolve(simple.compress(data));
    });
  });
}

async function decompress(data) {
  return new Promise((resolve, reject) => {
    ZstdCodec.run(zstd => {
      const simple = new zstd.Simple();
      resolve(dec.decode(simple.decompress(data)));
    });
  });
}

const _state = {
  signedIn: false,
  userData: null,
};

const getters = {
  profile: function(state) {
    if (state.userData !== null) {
      const person = new blockstack.Person(state.userData.profile);
      return {
        name: person.name(),
        avatarUrl: person.avatarUrl(),
      };
    } else {
      return null;
    }
  },
};

const actions = {
  loadSession: async function({ commit }, options) {
    const session = new blockstack.UserSession();
    let userData = null;
    if (session.isUserSignedIn()) {
      userData = session.loadUserData();
    } else if (options && options.authResponse) {
      userData = await session.handlePendingSignIn(options.authResponse);
    }
    if (userData !== null) {
      commit('signedIn', userData);
    }
    return userData;
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
  listFiles: function({ state }) {
    blockstack.listFiles(f => {
      console.log(f);
      return true;
    });
  },
  putFile: async function({ state }, { filename, data }) {
    data = await compress(data);
    console.log('compressed: ', data);
    await blockstack.putFile(filename, data);
  },
  getFile: async function({ state }, filename) {
    const data = await blockstack.getFile(filename);
    return await decompress(data);
  },
};

const mutations = {
  signedIn(state, userData) {
    state.signedIn = true;
    state.userData = userData;
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
