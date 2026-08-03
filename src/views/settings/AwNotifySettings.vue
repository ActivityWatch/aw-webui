<template lang="pug">
div
  div.d-flex.justify-content-between.align-items-center.mb-3
    div
      h5.mb-1 Activity Notifications
      small.text-muted Configure aw-notify alerts for Android and desktop
    b-btn(@click="save" size="sm" variant="primary" :disabled="saving || loading")
      | {{ saving ? 'Saving…' : 'Save' }}

  b-alert(v-if="error" show variant="danger") {{ error }}
  b-alert(v-if="success" show variant="success" dismissible @dismissed="success = false") Settings saved.

  div(v-if="loading")
    b-spinner(small) Loading…

  div(v-else)
    p.text-muted.small.mb-3
      | Alerts are checked periodically by aw-notify. Each alert fires a notification when
      | the accumulated time crosses a threshold. The same config works in Android and aw-tauri.

    div(v-if="alerts.length === 0")
      p.text-muted.font-italic No alerts configured.

    b-card.mb-2(v-for="(alert, idx) in alerts" :key="idx")
      div.d-flex.align-items-start
        div.flex-grow-1
          b-form-group(label="Label" label-cols-sm="3" label-size="sm")
            b-input(v-model="alert.label" size="sm" placeholder="e.g. Work")
          b-form-group(label="Category" label-cols-sm="3" label-size="sm")
            b-input(
              v-model="alert.category"
              size="sm"
              placeholder="All"
            )
            small.form-text.text-muted
              | Match the category name in your AW categorization rules, or use All for total time.
          b-form-group(
            label="Thresholds"
            label-cols-sm="3"
            label-size="sm"
            :invalid-feedback="thresholdError(alert.thresholdStr)"
            :state="thresholdState(alert.thresholdStr)"
          )
            b-input(
              v-model="alert.thresholdStr"
              size="sm"
              placeholder="e.g. 60, 120, 240"
              :state="thresholdState(alert.thresholdStr)"
            )
            small.form-text.text-muted Comma-separated positive whole minutes. A notification fires as each threshold is crossed.
          b-form-group(label="Type" label-cols-sm="3" label-size="sm")
            b-form-radio-group(v-model="alert.positive" :options="goalOptions" size="sm")
        b-btn.ml-2(@click="removeAlert(idx)" variant="outline-danger" size="sm" title="Remove alert")
          icon(name="trash")

    b-btn.mt-1(@click="addAlert" variant="outline-secondary" size="sm")
      icon(name="plus")
      |  Add alert
</template>

<script lang="ts">
import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/trash';

import { getClient } from '~/util/awclient';
import {
  AwNotifyAlert,
  AwNotifyConfig,
  parseAwNotifyConfig,
  parseThresholds,
} from '~/util/aw-notify';

const SETTINGS_KEY = 'aw-notify';

interface AlertRow {
  label: string;
  category: string;
  thresholdStr: string;
  positive: boolean;
}

function dtoToRow(dto: AwNotifyAlert): AlertRow {
  return {
    label: dto.label ?? '',
    category: dto.category,
    thresholdStr: dto.thresholds_minutes.join(', '),
    positive: dto.positive,
  };
}

function rowToDto(row: AlertRow): AwNotifyAlert {
  const thresholds = parseThresholds(row.thresholdStr);
  if (!thresholds) {
    throw new Error('Thresholds must be comma-separated positive whole minutes.');
  }
  return {
    label: row.label.trim() || null,
    category: row.category.trim() || 'All',
    thresholds_minutes: thresholds,
    positive: row.positive,
  };
}

export default {
  name: 'AwNotifySettings',
  data() {
    return {
      alerts: [] as AlertRow[],
      config: {} as AwNotifyConfig,
      loading: false,
      saving: false,
      error: '',
      success: false,
      goalOptions: [
        { text: 'Warning (exceeded limit)', value: false },
        { text: 'Goal (reached target)', value: true },
      ],
    };
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const client = getClient();
        const resp = await client.req.get(`/0/settings/${SETTINGS_KEY}`);
        const config = parseAwNotifyConfig(resp.data);
        if (!config) {
          throw new Error('The saved aw-notify setting has an unsupported format.');
        }
        this.config = config;
        this.alerts = config.alerts.map(dtoToRow);
      } catch (e: any) {
        if (e?.response?.status === 404) {
          this.config = {} as AwNotifyConfig;
          this.alerts = this.defaultAlerts();
        } else {
          this.error = `Failed to load settings: ${e?.message ?? e}`;
        }
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.error = '';
      this.success = false;
      if (this.alerts.some(row => parseThresholds(row.thresholdStr) === null)) {
        this.error = 'Thresholds must be comma-separated positive whole minutes.';
        return;
      }
      this.saving = true;
      try {
        const client = getClient();
        const payload: AwNotifyConfig = { ...this.config, alerts: this.alerts.map(rowToDto) };
        await client.req.post(`/0/settings/${SETTINGS_KEY}`, payload, {
          headers: { 'Content-Type': 'application/json' },
        });
        this.success = true;
      } catch (e: any) {
        this.error = `Failed to save settings: ${e?.message ?? e}`;
      } finally {
        this.saving = false;
      }
    },
    thresholdError(value: string): string {
      return parseThresholds(value) === null ? 'Use comma-separated positive whole minutes.' : '';
    },
    thresholdState(value: string): boolean | null {
      return parseThresholds(value) === null ? false : null;
    },
    addAlert() {
      this.alerts.push({
        label: '',
        category: 'All',
        thresholdStr: '60, 120',
        positive: false,
      });
    },
    removeAlert(idx: number) {
      this.alerts.splice(idx, 1);
    },
    defaultAlerts(): AlertRow[] {
      return [
        { label: 'All', category: 'All', thresholdStr: '60, 240, 480', positive: false },
        { label: '💼 Work', category: 'Work', thresholdStr: '60, 120, 240', positive: true },
      ];
    },
  },
};
</script>
