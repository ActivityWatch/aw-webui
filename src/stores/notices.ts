import { defineStore } from 'pinia';

// In-memory only. Each notice keeps its own persisted state (backoff, enabled flag)
// in the settings store; this store only records which notices are currently
// eligible, so the host and the bell agree on what there is to show.

interface State {
  ids: string[];
  unseen: string[];
  isOpen: boolean;
}

export const useNoticesStore = defineStore('notices', {
  state: (): State => ({
    ids: [],
    unseen: [],
    isOpen: false,
  }),

  getters: {
    count: state => state.ids.length,
    hasUnseen: state => state.unseen.length > 0,
  },

  actions: {
    publish(id: string) {
      if (this.ids.includes(id)) return;
      this.ids.push(id);
      if (!this.isOpen) this.unseen.push(id);
    },
    withdraw(id: string) {
      this.ids = this.ids.filter(i => i !== id);
      this.unseen = this.unseen.filter(i => i !== id);
    },
    open() {
      this.isOpen = true;
    },
    close() {
      this.isOpen = false;
    },
    markAllSeen() {
      this.unseen = [];
    },
  },
});
