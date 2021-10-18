<template lang="pug">
div
  h2 {{ $t('buckets') }}

  b-alert(show)
    | {{ $t('bucketsHelp') }} #[a(href="https://activitywatch.readthedocs.io/en/latest/watchers.html") {{ $t('documentation') }}] {{ $t('watchers') }}

  b-table(hover, small, :items="buckets", :fields="fields", responsive="md", sort-by="last_updated", :sort-desc="true")
    template(v-slot:cell(id)="data")
      small
        | {{ data.item.id }}
    template(v-slot:cell(hostname)="data")
      small
        | {{ data.item.hostname }}
    template(v-slot:cell(last_updated)="data")
      // aw-server-python
      small(v-if="data.item.last_updated")
        | {{ data.item.last_updated | friendlytime }}
      // aw-server-rust
      small(v-if="data.item.metadata && data.item.metadata.end")
        | {{ data.item.metadata.end | friendlytime }}
    template(v-slot:cell(actions)="data")
      b-button-toolbar.float-right
        b-button-group(size="sm", class="mx-1")
          b-button(variant="primary", :to="'/buckets/' + data.item.id")
            icon(name="folder-open").d-none.d-md-inline-block
            | {{ $t('open') }}
          b-dropdown(variant="outline-secondary", size="sm", text="More")
            b-dropdown-item(
                       :href="$aw.baseURL + '/api/0/buckets/' + data.item.id + '/export'",
                       :download="'aw-bucket-export-' + data.item.id + '.json'",
                       :title="$t('exportJson')",
                       variant="secondary")
                icon(name="download")
                | {{ $t('exportJson') }}
            b-dropdown-divider
            b-dropdown-item-button(@click="openDeleteBucketModal(data.item.id)",
                     :title="$t('deleteBucket')",
                     variant="danger")
              | #[icon(name="trash")] {{ $t('deleteBucket') }}

  b-modal(id="delete-modal", title="Danger!", centered, hide-footer)
    | {{ $t('deleteConf') }} "{{delete_bucket_selected}}"?
    br
    br
    b {{ $t('deletePerm') }}
    hr
    div.float-right
      b-button.mx-2(@click="$root.$emit('bv::hide::modal','delete-modal')")
        | {{ $t('cancel') }}
      b-button(@click="deleteBucket(delete_bucket_selected)", variant="danger")
        | {{ $t('confirm') }}

  h3 {{ $t('impExp') }}

  b-card-group.deck
    b-card(:header="$t('impBucket')")
      b-alert(v-if="import_error" show variant="danger" dismissable)
        | {{ import_error }}
      b-form-file(v-model="import_file"
                  :placeholder="$t('chooseFile')"
                  :drop-placeholder="$t('dropHere')")
      // TODO: This spinner could be placed in a more suitable place
      div(v-if="import_file" class="spinner-border" role="status")
      span
        | {{ $t('validFile') }}
        | {{ $t('sameName') }}
    b-card(:header="$t('expBuckets')")
      b-button-group(size="md")
        b-button(:href="$aw.baseURL + '/api/0/export'",
                :download="'aw-bucket-export.json'",
                :title="$t('expBucketsJson')",
                variant="outline-secondary")
          icon(name="download")
          | {{ $t('expBucketsJson') }}
        b-button(@click="exportToEspaceUn()",
                :disabled="loading"
                :title="$t('expEspace')",
                variant="outline-secondary")
          icon(name="download", v-if="!loading")
          div(v-if="loading" class="spinner-border" role="status")
          | {{ $t('expEspace') }}

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

<script>
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/download';
import 'vue-awesome/icons/folder-open';
import 'vue-awesome/icons/spinner';
import _ from 'lodash';

export default {
  name: 'Buckets',
  data() {
    return {
      import_file: null,
      import_error: null,
      delete_bucket_selected: null,
      fields: [
        { key: 'id', label: 'Bucket ID', sortable: true },
        { key: 'hostname', sortable: true },
        { key: 'last_updated', label: 'Updated', sortable: true },
        { key: 'actions', label: '' },
      ],
      loading: false,
    };
  },
  computed: {
    buckets: function () {
      return _.orderBy(this.$store.state.buckets.buckets, [b => b.id], ['asc']);
    },
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
          this.import_error = this.$t('importError');
        }
        // We need to reload buckets even if we fail because imports can be partial
        // (first bucket succeeds, second fails for example when importing multiple)
        await this.$store.dispatch('buckets/loadBuckets');
        this.import_file = null;
      }
    },
  },
  mounted: async function () {
    await this.$store.dispatch('buckets/ensureBuckets');
  },
  methods: {
    openDeleteBucketModal: function (bucketId) {
      this.delete_bucket_selected = bucketId;
      this.$root.$emit('bv::show::modal', 'delete-modal');
    },
    deleteBucket: async function (bucketId) {
      await this.$store.dispatch('buckets/deleteBucket', { bucketId });
      this.$root.$emit('bv::hide::modal', 'delete-modal');
    },
    importBuckets: async function (importFile) {
      const formData = new FormData();
      formData.append('buckets.json', importFile);
      const headers = { 'Content-Type': 'multipart/form-data' };
      return this.$aw.req.post('/0/import', formData, { headers });
    },
    exportToEspaceUn: async function () {
      this.loading = true;
      try {
        await this.$aw.req.get('/0/export-espaceun', { timeout: 300000 });
      } catch (err) {
        console.error(err);
      }
      this.loading = false;
    },
  },
};
</script>
