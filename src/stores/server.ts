import { defineStore } from 'pinia';
import { getClient } from '~/util/awclient';

interface State {
  info?: {
    hostname: string;
    device_id: string;
    version: string;
    testing: boolean;
  };
}

export const useServerStore = defineStore('server', {
  state: (): State => ({
    info: null,
  }),

  actions: {
    async getInfo() {
      try {
        const info = await getClient().getInfo();
        this.$patch({ info: info });
      } catch (e) {
        console.error('Unable to connect: ', e);
      }
    },
  },
});
