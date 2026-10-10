<template lang="pug">
div
  div.d-flex.justify-content-between.align-items-center.mb-3
    div
      h5.mb-1 {{ $t('settings.notifications.activityTitle') }}
      small.text-muted {{ $t('settings.notifications.activityHelp') }}
    b-btn(@click="save" size="sm" variant="primary" :disabled="saving || loading")
      | {{ saving ? $t('settings.notifications.saving') : $t('common.save') }}

  b-alert(v-if="error" show variant="danger") {{ error }}
  b-alert(v-if="success" show variant="success" dismissible @dismissed="success = false") {{ $t('settings.notifications.saved') }}

  div(v-if="loading")
    b-spinner(small) {{ $t('common.loading') }}

  div(v-else)
    b-form-group.mb-3
      b-form-checkbox(v-model="enabled" switch)
        | {{ $t('settings.notifications.enabled') }}
        small.text-muted.ml-2 {{ $t('settings.notifications.enabledHelp') }}

    template(v-if="enabled")
      p.text-muted.small.mb-3
        | {{ $t('settings.notifications.alertsHelp') }}

      div(v-if="alerts.length === 0")
        p.text-muted.font-italic {{ $t('settings.notifications.noAlerts') }}

      b-card.mb-2(v-for="(alert, idx) in alerts" :key="idx")
        div.d-flex.align-items-start
          div.flex-grow-1
            b-form-group(:label="$t('settings.notifications.label')" label-cols-sm="3" label-size="sm")
              b-input(v-model="alert.label" size="sm" :placeholder="$t('settings.notifications.labelPlaceholder')")
            b-form-group(:label="$t('settings.notifications.category')" label-cols-sm="3" label-size="sm")
              b-input(
                v-model="alert.category"
                size="sm"
                :placeholder="$t('settings.notifications.all')"
              )
              small.form-text.text-muted
                | {{ $t('settings.notifications.categoryHelp') }}
            b-form-group(
              :label="$t('settings.notifications.thresholds')"
              label-cols-sm="3"
              label-size="sm"
              :invalid-feedback="thresholdError(alert.thresholdStr)"
              :state="thresholdState(alert.thresholdStr)"
            )
              b-input(
                v-model="alert.thresholdStr"
                size="sm"
                :placeholder="$t('settings.notifications.thresholdsPlaceholder')"
                :state="thresholdState(alert.thresholdStr)"
              )
              small.form-text.text-muted {{ $t('settings.notifications.thresholdsHelp') }}
            b-form-group(:label="$t('settings.notifications.type')" label-cols-sm="3" label-size="sm")
              b-form-radio-group(v-model="alert.positive" :options="goalOptions" size="sm")
          b-btn.ml-2(@click="removeAlert(idx)" variant="outline-danger" size="sm" :title="$t('settings.notifications.removeAlert')")
            icon(name="trash")

      b-btn.mt-1(@click="addAlert" variant="outline-secondary" size="sm")
        icon(name="plus")
        |  {{ $t('settings.notifications.addAlert') }}
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
      enabled: false,
      alerts: [] as AlertRow[],
      config: {} as AwNotifyConfig,
      loading: false,
      saving: false,
      error: '',
      success: false,
    };
  },
  computed: {
    goalOptions() {
      return [
        { text: this.$t('settings.notifications.goalWarning'), value: false },
        { text: this.$t('settings.notifications.goalReached'), value: true },
      ];
    },
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
        // aw-server-rust answers 200 with an empty body (null) for a key that was
        // never set, rather than 404; treat both the same.
        if (resp.data === null || resp.data === undefined || resp.data === '') {
          this.useDefaults();
          return;
        }
        const config = parseAwNotifyConfig(resp.data);
        if (!config) {
          throw new Error(this.$t('settings.notifications.unsupportedFormat') as string);
        }
        this.config = config;
        this.enabled = config.enabled ?? false;
        this.alerts = config.alerts.map(dtoToRow);
      } catch (e: any) {
        if (e?.response?.status === 404) {
          this.useDefaults();
        } else {
          this.error = this.$t('settings.notifications.loadFailed', {
            error: e?.message ?? e,
          }) as string;
        }
      } finally {
        this.loading = false;
      }
    },
    useDefaults() {
      this.config = {} as AwNotifyConfig;
      this.enabled = false;
      this.alerts = this.defaultAlerts();
    },
    async save() {
      this.error = '';
      this.success = false;
      // When disabling, skip form validation and use the last-saved alerts so a
      // pending invalid edit in a hidden field cannot block the toggle.
      let alertDtos: AwNotifyAlert[];
      if (this.enabled) {
        if (this.alerts.some(row => parseThresholds(row.thresholdStr) === null)) {
          this.error = this.$t('settings.notifications.thresholdsInvalid') as string;
          return;
        }
        alertDtos = this.alerts.map(rowToDto);
      } else {
        alertDtos = this.config.alerts ?? [];
      }
      this.saving = true;
      try {
        const client = getClient();
        // Spread config first to preserve unknown keys (e.g. http_port, future fields),
        // then override enabled and alerts with the form values.
        const payload: AwNotifyConfig = {
          ...this.config,
          enabled: this.enabled,
          alerts: alertDtos,
        };
        await client.req.post(`/0/settings/${SETTINGS_KEY}`, payload, {
          headers: { 'Content-Type': 'application/json' },
        });
        // Keep this.config in sync so a subsequent disabled save uses the
        // latest saved alerts, not the stale snapshot from page load.
        this.config = payload;
        this.success = true;
      } catch (e: any) {
        this.error = this.$t('settings.notifications.saveFailed', {
          error: e?.message ?? e,
        }) as string;
      } finally {
        this.saving = false;
      }
    },
    thresholdError(value: string): string {
      return parseThresholds(value) === null
        ? (this.$t('settings.notifications.thresholdsInvalid') as string)
        : '';
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
