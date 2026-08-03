<template lang="pug">
div
  div.d-flex.justify-content-between.align-items-center.mb-3
    div
      h5.mb-1 Mobile Notifications
      small.text-muted Configure aw-notify alert thresholds for the Android app
    b-btn(@click="save" size="sm" variant="primary" :disabled="saving || loading")
      | {{ saving ? 'Saving…' : 'Save' }}

  b-alert(v-if="error" show variant="danger") {{ error }}
  b-alert(v-if="success" show variant="success" dismissible @dismissed="success = false") Settings saved.

  div(v-if="loading")
    b-spinner(small) Loading…

  div(v-else)
    p.text-muted.small.mb-3
      | Alerts are checked periodically by the Android app. Each alert fires a notification
      | when the accumulated time crosses a threshold.
      | Uses the #[code /api/0/settings/aw-notify] server setting.

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
              placeholder="Leave empty to track all time"
            )
            small.form-text.text-muted
              | Match the category name in your AW categorization rules, or leave empty for total time.
          b-form-group(label="Thresholds" label-cols-sm="3" label-size="sm")
            b-input(
              v-model="alert.thresholdStr"
              size="sm"
              placeholder="e.g. 60, 120, 240"
            )
            small.form-text.text-muted Comma-separated minutes. A notification fires as each threshold is crossed.
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

const SETTINGS_KEY = 'aw-notify';

interface AlertRow {
  label: string;
  category: string | null; // null = aggregate "All"
  thresholdStr: string;
  positive: boolean;
}

interface AlertDTO {
  label: string;
  category: string | null;
  thresholdMinutes: number[];
  positive: boolean;
}

function dtoToRow(dto: AlertDTO): AlertRow {
  return {
    label: dto.label,
    category: dto.category ?? '',
    thresholdStr: dto.thresholdMinutes.join(', '),
    positive: dto.positive,
  };
}

function rowToDto(row: AlertRow): AlertDTO {
  const thresholds = row.thresholdStr
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0);
  return {
    label: row.label,
    category: row.category && row.category.trim() !== '' ? row.category.trim() : null,
    thresholdMinutes: thresholds,
    positive: row.positive,
  };
}

export default {
  name: 'AwNotifySettings',
  data() {
    return {
      alerts: [] as AlertRow[],
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
        const data: AlertDTO[] = resp.data;
        if (Array.isArray(data) && data.length > 0) {
          this.alerts = data.map(dtoToRow);
        } else {
          this.alerts = this.defaultAlerts();
        }
      } catch (e: any) {
        if (e?.response?.status === 404) {
          this.alerts = this.defaultAlerts();
        } else {
          this.error = `Failed to load settings: ${e?.message ?? e}`;
        }
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.saving = true;
      this.error = '';
      this.success = false;
      try {
        const client = getClient();
        const payload: AlertDTO[] = this.alerts.map(rowToDto);
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
    addAlert() {
      this.alerts.push({
        label: '',
        category: '',
        thresholdStr: '60, 120',
        positive: false,
      });
    },
    removeAlert(idx: number) {
      this.alerts.splice(idx, 1);
    },
    defaultAlerts(): AlertRow[] {
      return [
        { label: 'All', category: '', thresholdStr: '60, 120, 240', positive: false },
        { label: 'Work', category: 'Work', thresholdStr: '15, 30, 60', positive: true },
      ];
    },
  },
};
</script>
