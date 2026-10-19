import { defineStore } from 'pinia';
import { getClient } from '~/util/awclient';
import { setSupportsMergeSubwatcherFields } from '~/util/serverCapabilities';

interface State {
  info?: {
    hostname: string;
    device_id: string;
    version: string;
    testing: boolean;
  };
}

/**
 * Probe whether the server knows the `merge_subwatcher_fields` query function
 * (added in aw-server-rust#824). The webui's supported server floor predates
 * it, so the activity query must not reference the function unless the server
 * can resolve it — otherwise the whole query fails with
 * `VariableNotDefined("merge_subwatcher_fields")`.
 *
 * The probe is a no-op query: empty base and subwatcher lists make the function
 * return immediately on servers that implement it.
 */
async function probeMergeSubwatcherFields(): Promise<void> {
  try {
    await getClient().query(
      ['2000-01-01T00:00:00Z/2000-01-01T00:00:01Z'],
      ['x = merge_subwatcher_fields([], [], ["url"], "sub_wins");']
    );
    setSupportsMergeSubwatcherFields(true);
  } catch {
    setSupportsMergeSubwatcherFields(false);
  }
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
      await probeMergeSubwatcherFields();
    },
  },
});
