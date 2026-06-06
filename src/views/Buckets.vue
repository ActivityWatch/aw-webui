<template lang="pug">
div
  h3 Buckets

  b-alert(show)
    | Are you looking to collect more data? Check out #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") the docs] for more watchers.

  // By device
  b-card.bucket-card.mb-3(
    v-for="device in bucketsStore.bucketsByDevice",
    :key="device.hostname || device.device_id",
    :class="{'bucket-card--unknown': device.hostname === 'unknown'}"
  )
    div.d-flex.justify-content-between.align-items-start.mb-2
      div.d-flex.align-items-center
        icon.mr-2.text-muted(v-if="device.hostname === 'unknown'" name="question" scale="1.2")
        icon.mr-2.text-secondary(v-else, name="desktop" scale="1.2")
        div
          span.font-weight-bold {{ device.hostname }}
          b-badge.ml-2(v-if="serverStore.info.hostname == device.hostname" variant="info") this device
          div.small.text-muted(v-if="device.hostname !== device.device_id")
            | ID: {{ device.id }}
          div.small(v-if="deviceHasEvents(device)")
            span.text-muted Last updated&nbsp;
            time(:class="{'text-success': isRecent(device.last_updated)}",
                 :datetime="device.last_updated",
                 :title="device.last_updated")
              | {{ device.last_updated | friendlytime }}
          div.small.text-muted(v-else)
            | No events recorded yet
      b-dropdown.kebab-dropdown(
        size="sm",
        variant="outline-secondary",
        toggle-class="border-0",
        no-caret,
        right,
        boundary="window",
        :title="`More actions for ${device.hostname}`",
        :aria-label="`More actions for ${device.hostname}`"
      )
        template(v-slot:button-content)
          icon(name="ellipsis-v")
        b-dropdown-item-button(
          @click="openDeleteHostModal(device)",
          button-class="text-danger",
          :title="`Delete all ${device.buckets.length} buckets for ${device.hostname}`"
        )
          icon.mr-1(name="trash")
          | Delete all buckets for this host

    // No `responsive` wrapper: with fixed column widths the table fits its
    // container, and dropping the wrapper means the row dropdowns can render
    // outside the table without being clipped by overflow-x: auto.
    b-table.mb-0.bucket-table(
      small, hover,
      :items="device.buckets",
      :fields="fields"
    )
      template(v-slot:cell(id)="data")
        small.text-monospace.bucket-id(:title="data.item.id") {{ data.item.id }}
      template(v-slot:cell(last_updated)="data")
        small(v-if="bucketHasEvents(data.item)", :class="{'text-success': isRecent(data.item.last_updated)}")
          | {{ data.item.last_updated | friendlytime }}
        small.text-muted(v-else) no events
      template(v-slot:cell(actions)="data")
        b-button-group(size="sm")
          b-button(variant="primary", :to="'/buckets/' + data.item.id", title="Open bucket")
            icon.d-none.d-md-inline-block.mr-1(name="folder-open")
            | Open
          // boundary="window" so the menu renders on top of the
          // b-table's responsive overflow wrapper instead of being clipped
          // (which previously made the whole row turn into a scrollbox).
          b-dropdown.kebab-dropdown(variant="outline-secondary", toggle-class="border-0", size="sm", right, no-caret, boundary="window", title="More actions")
            template(v-slot:button-content)
              icon(name="ellipsis-v")
            // FIXME: These also exist as almost-copies in the Bucket view, can maybe be shared/reused instead.
            b-dropdown-item(@click="export_bucket_json(data.item.id)", title="Export bucket to JSON")
              icon.mr-1(name="download")
              | Export as JSON
            b-dropdown-item(@click="export_csv(data.item.id)", title="Export events to CSV")
              icon.mr-1(name="download")
              | Export events as CSV
            b-dropdown-divider
            b-dropdown-item-button(@click="openDeleteBucketModal(data.item.id)", title="Delete this bucket permanently", button-class="text-danger")
              icon.mr-1(name="trash")
              | Delete bucket

    div(v-for="msg in runChecks(device)" :key="msg")
      b-alert.mt-2.mb-0.py-1.px-2.small(show variant="warning")
        icon(name="exclamation-triangle")
        | &nbsp;
        | {{ msg }}

  b-modal(id="delete-modal", title="Delete bucket?", centered, hide-footer)
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

  b-modal(id="delete-host-modal", :title="delete_host_selected ? `Delete all buckets for ${delete_host_selected.hostname}?` : 'Delete buckets?'", centered, hide-footer, @hidden="delete_host_selected = null; delete_host_error = null")
    template(v-if="delete_host_selected")
      | Are you sure you want to delete
      |
      b all {{ delete_host_selected.bucketCount }} buckets
      |
      | for host "{{ delete_host_selected.hostname }}"?
      br
      br
      b This is permanent and cannot be undone!
      div.small.text-muted.mt-2(style="max-height: 200px; overflow-y: auto;")
        | Buckets that will be deleted:
        ul.mb-0
          li(v-for="bucketId in delete_host_selected.bucketIds", :key="bucketId")
            code {{ bucketId }}
      b-alert.mt-2(v-if="delete_host_error" show variant="danger")
        | {{ delete_host_error }}
      hr
      div.float-right
        b-button.mx-2(@click="$root.$emit('bv::hide::modal','delete-host-modal')")
          | Cancel
        b-button(@click="deleteBucketsForSelectedHost()",
                 :disabled="deleting_host",
                 variant="danger")
          template(v-if="deleting_host")
            | Deleting...
          template(v-else)
            | Confirm

  h4.mt-4 Import and export buckets

  b-card-group.deck
    b-card(header="Import buckets")
      b-alert(v-if="import_error" show variant="danger" dismissible)
        | {{ import_error }}
      b-form-file(v-model="import_file"
                  placeholder="Choose or drop a file here..."
                  drop-placeholder="Drop file here...")
      div.mt-2(v-if="import_file")
        b-spinner.mr-2(small)
        small.text-muted Importing...
      small.d-block.mt-2.text-muted
        | Provide a JSON file exported from a single bucket or from multiple buckets.
        | Import fails if a bucket with the same ID already exists.
    b-card(header="Export buckets")
      p.small.text-muted Download every bucket on this server as a single JSON file. Use this for backups.
      b-button(@click="export_all_buckets_json()",
               title="Export all buckets to JSON",
               variant="outline-secondary")
        icon.mr-1(name="download")
        | Export all buckets as JSON

  hr

  aw-devonly(reason="This section is still under development")
    h4.p-2 Tools

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

.bucket-card--unknown {
  opacity: 0.85;
  background: #fbfbfb;
}

.bucket-table {
  table-layout: fixed;
}

::v-deep .bucket-table td {
  vertical-align: middle;
}

// Truncate only the bucket id span itself, not the cell — applying
// overflow:hidden to the td clips the row's kebab popover menu.
::v-deep .bucket-id {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

// Ghost-styled kebab dropdowns: invisible until hover/focus, like
// the "borderless" overflow menus in most modern UIs.
::v-deep .kebab-dropdown > .btn {
  color: #6c757d;
  background: transparent;
}

::v-deep .kebab-dropdown > .btn:hover,
::v-deep .kebab-dropdown > .btn:focus,
::v-deep .kebab-dropdown.show > .btn {
  background: #f0f1f3;
  color: #212529;
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
import 'vue-awesome/icons/ellipsis-v';

import _ from 'lodash';
import Papa from 'papaparse';
import moment from 'moment';

import { useServerStore } from '~/stores/server';
import { useBucketsStore } from '~/stores/buckets';
import { downloadFile } from '~/util/export';

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
      delete_host_selected: null,
      deleting_host: false,
      delete_host_error: null,
      // Explicit thStyle widths so each device's table aligns with the
      // others (b-table otherwise auto-fits per-card based on its own
      // content, which produced jagged columns across hosts).
      fields: [
        {
          key: 'id',
          label: 'Bucket ID',
          sortable: true,
          thStyle: { width: '45%' },
        },
        {
          key: 'hostname',
          sortable: true,
          thStyle: { width: '25%' },
        },
        {
          key: 'last_updated',
          label: 'Updated',
          sortable: true,
          thStyle: { width: '15%' },
        },
        {
          key: 'actions',
          label: '',
          thStyle: { width: '15%' },
          tdClass: 'text-right',
        },
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
    // last_updated is only set once a bucket has actually been written to:
    //   - aw-server-python omits it when the bucket has no events
    //   - aw-server-rust's store harmonization (see update_buckets) sets
    //     last_updated from metadata.end, which is also only present once
    //     events exist
    // The previous device-level "Last updated 0s ago" was just moment(undefined).fromNow().
    bucketHasEvents: function (bucket) {
      return Boolean(bucket && bucket.last_updated);
    },
    deviceHasEvents: function (device) {
      return _.some(device.buckets, b => this.bucketHasEvents(b));
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
    openDeleteHostModal: function (device) {
      this.delete_host_selected = {
        hostname: device.hostname,
        bucketCount: device.buckets.length,
        bucketIds: device.buckets.map(b => b.id),
      };
      this.$root.$emit('bv::show::modal', 'delete-host-modal');
    },
    deleteBucketsForSelectedHost: async function () {
      if (!this.delete_host_selected) return;
      this.deleting_host = true;
      this.delete_host_error = null;
      try {
        await this.bucketsStore.deleteBucketsByHost({
          bucketIds: this.delete_host_selected.bucketIds,
        });
        this.$root.$emit('bv::hide::modal', 'delete-host-modal');
      } catch (err) {
        this.delete_host_error =
          err?.message || 'Deletion failed. Some buckets may not have been deleted.';
      } finally {
        this.deleting_host = false;
      }
    },
    importBuckets: async function (importFile) {
      const formData = new FormData();
      formData.append('buckets.json', importFile);
      const headers = { 'Content-Type': 'multipart/form-data' };
      return this.$aw.req.post('/0/import', formData, { headers });
    },

    async export_bucket_json(bucketId: string) {
      const response = await this.$aw.req.get(`/0/buckets/${bucketId}/export`);
      const data = JSON.stringify(response.data, null, 2);
      await downloadFile(`aw-bucket-export-${bucketId}.json`, data, 'application/json');
    },

    async export_all_buckets_json() {
      const response = await this.$aw.req.get('/0/export');
      const data = JSON.stringify(response.data, null, 2);
      await downloadFile('aw-bucket-export.json', data, 'application/json');
    },

    async export_csv(bucketId: string) {
      const bucket = await this.bucketsStore.getBucketWithEvents({ id: bucketId });
      const events = bucket.events;
      const datakeys = events.length > 0 ? Object.keys(events[0].data) : [];
      const columns = ['timestamp', 'duration'].concat(datakeys);
      const data = events.map(e => {
        return Object.assign(
          { timestamp: e.timestamp, duration: e.duration },
          Object.fromEntries(datakeys.map(k => [k, e.data[k]]))
        );
      });
      const csv = Papa.unparse(data, { columns, header: true });
      const filename = `aw-events-export-${bucketId}-${new Date()
        .toISOString()
        .substring(0, 10)}.csv`;
      await downloadFile(filename, csv, 'text/csv');
    },
  },
};
</script>
