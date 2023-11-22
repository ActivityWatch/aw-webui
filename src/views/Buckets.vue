<template lang="pug">
div
  h2 Buckets

  b-alert(show)
    | Are you looking to collect more data? Check out #[a(href="https://activitywatch.readthedocs.io/en/latest/watchers.html") the docs] for more watchers.

  // By device
  b-card.mb-3(v-for="device in bucketsStore.bucketsByDevice", :key="device.hostname || device.device_id")
    div.mb-3
      div.d-flex
        div
          icon(v-if="device.hostname === 'unknown'" name="question")
          // TODO: detect device type somewhere else (should unify with store logic)
          icon(v-else, name="desktop")
          | &nbsp;
        div
          b {{ device.hostname }}
          span.small.ml-2(v-if="serverStore.info.hostname == device.hostname")
            | (the current device)
          div.small
            div(v-if="device.hostname !== device.device_id", style="color: #666")
              | ID: {{ device.id }}
            div
              | Last updated:&nbsp;
              time(:style="{'color': isRecent(device.last_updated) ? 'green' : 'inherit'}",
                   :datetime="device.last_updated",
                   :title="device.last_updated")
                | {{ device.last_updated | friendlytime }}
            div
              | First seen:&nbsp;
              time(:datetime="device.first_seen",
                   :title="device.first_seen")
                | {{ device.first_seen | friendlytime }}

    b-row
      b-col
        b-table.mb-0(small, hover, :items="device.buckets", :fields="fields", responsive="md")
          template(v-slot:cell(last_updated)="data")
            small(v-if="data.item.last_updated", :style="{'color': isRecent(data.item.last_updated) ? 'green' : 'inherit'}")
              | {{ data.item.last_updated | friendlytime }}
          template(v-slot:cell(actions)="data")
            b-button-toolbar.float-right
              b-button-group(size="sm", class="mx-1")
                b-button(variant="primary", :to="'/buckets/' + data.item.id")
                  icon(name="folder-open").d-none.d-md-inline-block
                  | Open
                b-dropdown(variant="outline-secondary", size="sm", text="More")
                  // FIXME: These also exist as almost-copies in the Bucket view, can maybe be shared/reused instead.
                  b-dropdown-item(
                             :href="$aw.baseURL + '/api/0/buckets/' + data.item.id + '/export'",
                             :download="'aw-bucket-export-' + data.item.id + '.json'",
                             title="Export bucket to JSON",
                             variant="secondary")
                      icon(name="download")
                      | Export bucket as JSON
                  b-dropdown-item(
                              @click="export_csv(data.item.id)",
                             title="Export events to CSV",
                             variant="secondary")
                      icon(name="download")
                      | Export events as CSV
                  b-dropdown-divider
                  b-dropdown-item-button(@click="openDeleteBucketModal(data.item.id)",
                           title="Delete this bucket permanently",
                           variant="danger")
                    | #[icon(name="trash")] Delete bucket

    // Checks
    hr.mt-1(v-if="runChecks(device).length > 0")
    div.small.text-muted(v-for="msg in runChecks(device)", style="color: #333")
      icon(name="exclamation-triangle")
      | &nbsp;
      | {{ msg }}

  b-modal(id="delete-modal", title="Danger!", centered, hide-footer)
    | Are you sure you want to delete bucket "{{delete_bucket_selected}}"?
    br
    br
    b This is permanent and cannot be undone!
    hr
    div.float-right
      b-button.mx-2(@click="$root.$emit('bv::hide::modal','delete-modal')")
        | Cancel
      b-button(@click="deleteBucket(delete_bucket_selected)", variant="danger")
        | Confirm

  h3 Import and export buckets

  b-card-group.deck
    b-card(header="Import buckets")
      b-alert(v-if="import_error" show variant="danger" dismissable)
        | {{ import_error }}
      b-form-file(v-model="import_file"
                  placeholder="Choose or drop a file here..."
                  drop-placeholder="Drop file here...")
      // TODO: This spinner could be placed in a more suitable place
      div(v-if="import_file" class="spinner-border" role="status")
      span
        | A valid file to import is a JSON file from either an export of a single bucket or an export from multiple buckets.
        | If there are buckets with the same name the import will fail.
    b-card(header="Export buckets")
      b-button(:href="$aw.baseURL + '/api/0/export'",
               :download="'aw-bucket-export.json'",
               title="Export bucket to JSON",
               variant="outline-secondary")
        icon(name="download")
        | Export all buckets as JSON

  hr

  aw-devonly(reason="This section is still under development")
    h2.p-2 Tools

    hr

    aw-bucket-validate.p-2

    hr

    aw-bucket-merge.p-2
</template>

<style lang="scss">
// This won't work if scoped
.bucket-card {
  .card-header,
  .card-footer {
    padding: 0.5em 0.75em 0.5em 0.75em;
  }

  .card-body {
    padding: 0.5em;
  }
}
</style>

<style scoped lang="scss">
.bucket-card {
  margin-bottom: 1em;
}

.bucket-last-updated {
  color: #666;
}
</style>

<script lang="ts">
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/download';
import 'vue-awesome/icons/folder-open';
import 'vue-awesome/icons/desktop';
import 'vue-awesome/icons/mobile';
import 'vue-awesome/icons/question';
import 'vue-awesome/icons/exclamation-triangle';

import _ from 'lodash';
import Papa from 'papaparse';
import moment from 'moment';

import { useServerStore } from '~/stores/server';
import { useBucketsStore } from '~/stores/buckets';

export default {
  name: 'Buckets',
  components: {
    'aw-bucket-merge': () => import('~/components/BucketMerge.vue'),
    'aw-bucket-validate': () => import('~/components/BucketValidate.vue'),
  },
  data() {
    return {
      moment,
      bucketsStore: useBucketsStore(),
      serverStore: useServerStore(),

      import_file: null,
      import_error: null,
      delete_bucket_selected: null,
      fields: [
        { key: 'id', label: 'Bucket ID', sortable: true },
        { key: 'hostname', sortable: true },
        { key: 'last_updated', label: 'Updated', sortable: true },
        { key: 'actions', label: '' },
      ],
    };
  },
  watch: {
    import_file: async function (_new_value, _old_value) {
      if (this.import_file != null) {
        console.log('Importing file');
        try {
          await this.importBuckets(this.import_file);
          console.log('Import successful');
          this.import_error = null;
        } catch (err) {
          console.log('Import failed');
          // TODO: Make aw-server report error message so it can be shown in the web-ui
          this.import_error = 'Import failed, see aw-server logs for more info';
        }
        // We need to reload buckets even if we fail because imports can be partial
        // (first bucket succeeds, second fails for example when importing multiple)
        await this.bucketsStore.loadBuckets();
        this.import_file = null;
      }
    },
  },
  mounted: async function () {
    // load or reload buckets on mount
    await this.bucketsStore.loadBuckets();
  },
  methods: {
    isRecent: function (date) {
      return moment().diff(date) / 1000 < 120;
    },
    runChecks: function (device) {
      const checks = [
        {
          msg: () => {
            return `Device known by several hostnames: ${device.hostnames}`;
          },
          failed: () => device.hostnames.length > 1,
        },
        {
          msg: () => {
            return `Device known by several IDs: ${device.device_ids}`;
          },
          failed: () => device.device_ids.length > 1,
        },
        {
          msg: () => {
            return `Device is a special device, unattributed to a hostname, or not assigned a device ID.`;
          },
          failed: () => _.isEqual(device.hostnames, ['unknown']),
        },
        //{
        //  msg: () => 'just a test',
        //  failed: () => true,
        //},
      ];
      const failedChecks = _.filter(checks, c => c.failed());
      return _.map(failedChecks, c => c.msg());
    },
    openDeleteBucketModal: function (bucketId: string) {
      this.delete_bucket_selected = bucketId;
      this.$root.$emit('bv::show::modal', 'delete-modal');
    },
    deleteBucket: async function (bucketId: string) {
      await this.bucketsStore.deleteBucket({ bucketId });
      this.$root.$emit('bv::hide::modal', 'delete-modal');
    },
    importBuckets: async function (importFile) {
      const formData = new FormData();
      formData.append('buckets.json', importFile);
      const headers = { 'Content-Type': 'multipart/form-data' };
      return this.$aw.req.post('/0/import', formData, { headers });
    },

    async export_csv(bucketId: string) {
      const bucket = await this.bucketsStore.getBucketWithEvents({ id: bucketId });
      const events = bucket.events;
      const datakeys = Object.keys(events[0].data);
      const columns = ['timestamp', 'duration'].concat(datakeys);
      const data = events.map(e => {
        return Object.assign(
          { timestamp: e.timestamp, duration: e.duration },
          Object.fromEntries(datakeys.map(k => [k, e.data[k]]))
        );
      });
      const csv = Papa.unparse(data, { columns, header: true });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aw-events-export-${bucketId}-${new Date()
        .toISOString()
        .substring(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  },
};
</script>
