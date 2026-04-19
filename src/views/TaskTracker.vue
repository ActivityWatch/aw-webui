<template lang="pug">
div.tt-container
  h1.tt-title Трекер времени

  // Task & Template Creation
  section.tt-section
    div.tt-section-header
      b-button(@click="showCreateForm = !showCreateForm", variant="primary")
        | + Добавить задачу
      b-button.ml-2(@click="openTemplateModal", variant="info")
        | + Добавить шаблон

    b-collapse(v-model="showCreateForm", class="mt-2")
      b-input-group
        b-input(
          v-model="newTaskName"
          placeholder="Название задачи..."
          @keyup.enter.native="createTask"
        )
        b-input-group-append
          b-button(
            @click="createTask"
            :disabled="loading || !newTaskName.trim()"
            variant="success"
          ) Создать
          b-button(@click="cancelCreate", variant="secondary") Отмена

  // Task Selector
  section.tt-section
    h2.tt-section-title Выберите задачу
    b-input-group
      b-form-select(
        v-model.number="selectedTaskId"
        :options="taskSelectOptions"
        @change="onTaskSelect"
      )
      b-input-group-append(v-if="selectedTaskId")
        b-button(@click="deselectAll", variant="danger", title="Снять выбор") ✕

    // Task list cards
    div.tt-task-list(v-if="tasks.length > 0")
      div.tt-task-card(
        v-for="task in tasks"
        :key="task.id"
        :class="{ 'tt-task-card--active': selectedTaskId === task.id }"
        @click="selectTask(task.id)"
      )
        div.tt-task-info
          div.tt-task-name {{ task.name }}
          div.tt-task-desc(v-if="task.description") {{ task.description }}
        b-button.tt-task-delete(
          size="sm"
          variant="outline-danger"
          @click.stop="deleteTask(task.id)"
        ) Удалить

  // Summary
  section.tt-section(v-if="selectedTaskId")
    h2.tt-section-title Итого по задаче
    b-row
      b-col(
        v-for="cat in categories"
        :key="cat.key"
        cols="4"
      )
        div.tt-summary-card(:class="`tt-summary-card--${cat.key.toLowerCase()}`")
          div.tt-summary-label(:class="cat.colorClass") {{ cat.label }}
          div.tt-summary-duration(:class="cat.colorClass") {{ formatDuration(summary[cat.key]) }}

  // Tabs: Applications / Templates
  section.tt-section
    b-tabs(v-model="activeTab" content-class="mt-3")
      b-tab(title="Приложения")
        span.tt-loading(v-if="syncingApps") Загрузка...

        div(v-if="!selectedTaskId")
          p.tt-empty-msg Выберите задачу, чтобы увидеть список приложений

        div(v-else-if="appUsages.length === 0")
          p.tt-empty-msg Нет данных о приложениях

        div.tt-app-list(v-else)
          div.tt-app-card(v-for="au in appUsages" :key="au.id")
            div.tt-app-info
              div.tt-app-name {{ au.appName }}
              div.tt-app-duration {{ formatDuration(au.totalSeconds) }}
            b-form-select.tt-app-category(
              v-model.number="au._categoryIdx"
              :options="categoryOptions"
              @change="onCategoryChange(au, $event)"
              :class="categoryColorClass(au.category)"
            )

      b-tab(title="Шаблоны")
        h3.tt-sub-section-title Общие шаблоны
        div(v-if="generalTemplates.length === 0")
          p.tt-empty-msg Нет общих шаблонов

        div.tt-template-list
          div.tt-template-card(v-for="tmpl in generalTemplates" :key="tmpl.id")
            div.tt-template-info
              div.tt-template-name {{ tmpl.name }}
              div.tt-template-category(
                :class="categoryColorClass(tmpl.category)"
              ) {{ categoryLabel(tmpl.category) }}
            div.tt-template-actions
              b-button.tt-tmpl-edit(
                size="sm"
                variant="outline-primary"
                @click="openEditTemplateModal(tmpl)"
              ) Редактировать
              b-button.tt-tmpl-delete(
                size="sm"
                variant="outline-danger"
                @click="deleteTemplate(tmpl.id)"
              ) Удалить

        h3.tt-sub-section-title Шаблоны задачи
        div(v-if="!selectedTaskId")
          p.tt-empty-msg Выберите задачу, чтобы увидеть её шаблоны
        div(v-else-if="taskTemplates.length === 0")
          p.tt-empty-msg Нет шаблонов для этой задачи

        div.tt-template-list(v-else)
          div.tt-template-card(v-for="tmpl in taskTemplates" :key="tmpl.id")
            div.tt-template-info
              div.tt-template-name {{ tmpl.name }}
              div.tt-template-category(
                :class="categoryColorClass(tmpl.category)"
              ) {{ categoryLabel(tmpl.category) }}
            div.tt-template-actions
              b-button.tt-tmpl-edit(
                size="sm"
                variant="outline-primary"
                @click="openEditTemplateModal(tmpl)"
              ) Редактировать
              b-button.tt-tmpl-delete(
                size="sm"
                variant="outline-danger"
                @click="deleteTemplate(tmpl.id)"
              ) Удалить

  // Template Modal (Create / Edit)
  b-modal(
    v-model="showTemplateModal"
    :title="editTemplateId ? 'Редактировать шаблон' : 'Добавить шаблон'"
    @ok="handleTemplateSubmit"
    @cancel="cancelTemplate"
    :ok-disabled="!newTemplateName.trim()"
  )
    b-form-group(label="Название шаблона")
      b-input(
        v-model="newTemplateName"
        placeholder="Название шаблона..."
        @keyup.enter.native="handleTemplateSubmit"
      )
    b-form-group(label="Категория")
      b-form-select(
        v-model="newTemplateCategory"
        :options="templateCategoryOptions"
      )
    b-form-group(label="Привязка")
      b-form-select(
        v-model="newTemplateScope"
        :options="templateScopeOptions"
      )
</template>

<style scoped lang="scss">
.tt-container {
  max-width: 48rem;
  margin: 0 auto;
  padding: 1.5rem;
}

.tt-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.tt-section {
  margin-bottom: 2rem;
}

.tt-section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tt-section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.tt-sub-section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #374151;
}

/* Task list */
.tt-task-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.tt-task-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-radius: 0.5rem;
  background: #f3f4f6;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #e5e7eb;
  }

  &--active {
    background: #dbeafe;
    box-shadow: inset 0 0 0 2px #3b82f6;
  }
}

.tt-task-info {
  flex: 1;
  min-width: 0;
}

.tt-task-name {
  font-weight: 500;
}

.tt-task-desc {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.tt-task-delete {
  margin-left: 0.75rem;
}

/* Summary cards */
.tt-summary-card {
  padding: 1rem;
  border-radius: 0.5rem;

  &--productive {
    background: rgba(34, 197, 94, 0.15);
  }
  &--unproductive {
    background: rgba(239, 68, 68, 0.15);
  }
  &--neutral {
    background: #f3f4f6;
  }
}

.tt-summary-label {
  font-size: 0.875rem;
}

.tt-summary-duration {
  font-size: 1.5rem;
  font-weight: 700;
}

.text-green {
  color: #16a34a;
}
.text-red {
  color: #dc2626;
}
.text-gray {
  color: #6b7280;
}

/* App list */
.tt-app-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tt-app-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-radius: 0.5rem;
  background: #f3f4f6;
}

.tt-app-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tt-app-name {
  font-weight: 500;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tt-app-duration {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
  white-space: nowrap;
}

.tt-app-category {
  margin-left: 1rem;
  min-width: 10rem;
  width: auto;
}

/* Override Bootstrap's custom-select/form-control width: 100% */
.tt-app-category.form-control,
.tt-app-category.custom-select {
  width: auto;
}

.tt-empty-msg {
  text-align: center;
  color: #6b7280;
  padding: 2rem 0;
}

.tt-loading {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Template list */
.tt-template-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tt-template-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-radius: 0.5rem;
  background: #f3f4f6;
}

.tt-template-info {
  flex: 1;
  min-width: 0;
}

.tt-template-name {
  font-weight: 500;
}

.tt-template-category {
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.tt-template-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
}

.tt-tmpl-edit,
.tt-tmpl-delete {
  white-space: nowrap;
}
</style>

<script lang="ts">
import { taskTrackerApi } from '~/util/taskTrackerClient';

const CATEGORIES = [
  { key: 'PRODUCTIVE', label: 'Продуктивно', colorClass: 'text-green' },
  { key: 'UNPRODUCTIVE', label: 'Не продуктивно', colorClass: 'text-red' },
  { key: 'NEUTRAL', label: 'Нейтрально', colorClass: 'text-gray' },
];

export default {
  name: 'TaskTracker',
  data() {
    return {
      tasks: [] as any[],
      selectedTaskId: null as number | null,
      appUsages: [] as any[],
      newTaskName: '',
      showCreateForm: false,
      loading: false,
      syncingApps: false,
      tasksLoaded: false,
      categories: CATEGORIES,
      categoryOptions: CATEGORIES.map((c, i) => ({ value: i, text: c.label })),
      // Template
      showTemplateModal: false,
      newTemplateName: '',
      newTemplateCategory: 'PRODUCTIVE',
      newTemplateScope: 'general' as 'general' | 'task',
      editTemplateId: null as number | null,
      templateCategoryOptions: [
        { value: 'PRODUCTIVE', text: 'Продуктивно' },
        { value: 'UNPRODUCTIVE', text: 'Не продуктивно' },
        { value: 'NEUTRAL', text: 'Нейтрально' },
      ],
      templateScopeOptions: [
        { value: 'general', text: 'Общий' },
        { value: 'task', text: 'Для текущей задачи' },
      ],
      templates: [] as any[],
      activeTab: 0,
    };
  },

  computed: {
    taskSelectOptions(): any[] {
      return [
        { value: 0, text: '-- Выберите задачу --' },
        ...this.tasks.map((t: any) => ({ value: t.id, text: t.name })),
      ];
    },

    summary(): Record<string, number> {
      const acc: Record<string, number> = { PRODUCTIVE: 0, UNPRODUCTIVE: 0, NEUTRAL: 0 };
      for (const au of this.appUsages) {
        acc[au.category] += au.totalSeconds;
      }
      return acc;
    },

    generalTemplates(): any[] {
      return this.templates.filter((t: any) => t.taskId === null);
    },

    taskTemplates(): any[] {
      return this.templates.filter((t: any) => t.taskId !== null);
    },
  },

  async created() {
    await this.fetchTasks();
    await this.fetchTemplates();
  },

  watch: {
    async selectedTaskId(newId: number | null) {
      if (newId && this.tasksLoaded) {
        await this.syncAppUsages(newId);
      } else if (!newId && this.tasksLoaded) {
        this.appUsages = [];
      }
    },
    tasksLoaded(val: boolean) {
      // Mirrors the React useEffect([selectedTaskId, tasksLoaded]) behavior:
      // if tasksLoaded just became true but no task is selected, clear usages
      if (val && !this.selectedTaskId) {
        this.appUsages = [];
      }
    },
  },

  methods: {
    formatDuration(seconds: number): string {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) return `${h}ч ${m}м ${s}с`;
      if (m > 0) return `${m}м ${s}с`;
      return `${s}с`;
    },

    categoryColorClass(cat: string): string {
      const found = CATEGORIES.find(c => c.key === cat);
      return found ? found.colorClass : 'text-gray';
    },

    categoryLabel(cat: string): string {
      const found = CATEGORIES.find(c => c.key === cat);
      return found ? found.label : cat;
    },

    async fetchTasks() {
      try {
        const tasks = await taskTrackerApi.getTasks();
        this.tasks = tasks;
        const active = tasks.find((t: any) => t.isActive);
        if (active) this.selectedTaskId = active.id;
        this.tasksLoaded = true;
      } catch (e) {
        console.error('Error fetching tasks:', e);
      }
    },

    async createTask() {
      if (!this.newTaskName.trim()) return;
      this.loading = true;
      try {
        const task = await taskTrackerApi.createTask(this.newTaskName.trim());
        this.tasks.unshift(task);
        this.newTaskName = '';
        this.showCreateForm = false;
      } catch (e) {
        console.error('Error creating task:', e);
      } finally {
        this.loading = false;
      }
    },

    cancelCreate() {
      this.showCreateForm = false;
      this.newTaskName = '';
    },

    async deleteTask(taskId: number) {
      if (!confirm('Удалить эту задачу?')) return;
      try {
        await taskTrackerApi.deleteTask(taskId);
        this.tasks = this.tasks.filter((t: any) => t.id !== taskId);
        if (this.selectedTaskId === taskId) this.selectedTaskId = null;
      } catch (e) {
        console.error('Error deleting task:', e);
      }
    },

    async selectTask(taskId: number) {
      if (this.selectedTaskId === taskId) return;
      try {
        if (this.selectedTaskId) {
          await taskTrackerApi.deselectTask(this.selectedTaskId);
        }
        await taskTrackerApi.selectTask(taskId);
        this.selectedTaskId = taskId;
        // Update local task states
        this.tasks.forEach((t: any) => {
          t.isActive = t.id === taskId;
        });
      } catch (e) {
        console.error('Error selecting task:', e);
      }
    },

    onTaskSelect(val: number) {
      if (val) this.selectTask(val);
    },

    async deselectAll() {
      if (this.selectedTaskId) {
        try {
          await taskTrackerApi.deselectTask(this.selectedTaskId);
          this.selectedTaskId = null;
          this.tasks.forEach((t: any) => (t.isActive = false));
        } catch (e) {
          console.error('Error deselecting task:', e);
        }
      }
    },

    async syncAppUsages(taskId: number) {
      this.syncingApps = true;
      try {
        const timeEntries = await taskTrackerApi.getTimeEntries(taskId);
        if (timeEntries.length === 0) {
          this.appUsages = [];
          return;
        }

        const usages = await taskTrackerApi.syncActivityWatch(taskId);
        this.appUsages = usages.map((u: any) => ({
          ...u,
          _categoryIdx: CATEGORIES.findIndex(c => c.key === u.category),
        }));
      } catch (e) {
        console.error('Error syncing app usages:', e);
      } finally {
        this.syncingApps = false;
      }
    },

    async onCategoryChange(au: any, idx: any) {
      const cat = CATEGORIES[idx]?.key;
      if (!cat || !this.selectedTaskId) return;
      try {
        const updated = await taskTrackerApi.updateAppCategory(
          this.selectedTaskId,
          au.id,
          cat
        );
        Object.assign(au, updated, { _categoryIdx: idx });
      } catch (e) {
        console.error('Error updating app category:', e);
      }
    },

    // ── Templates ──

    async fetchTemplates() {
      try {
        const taskId = this.selectedTaskId;
        const templates = await taskTrackerApi.getTemplates();
        this.templates = templates;
      } catch (e) {
        console.error('Error fetching templates:', e);
      }
    },

    openTemplateModal() {
      this.editTemplateId = null;
      this.showTemplateModal = true;
      this.newTemplateName = '';
      this.newTemplateCategory = 'PRODUCTIVE';
      this.newTemplateScope = 'general';
    },

    openEditTemplateModal(tmpl: any) {
      this.editTemplateId = tmpl.id;
      this.showTemplateModal = true;
      this.newTemplateName = tmpl.name;
      this.newTemplateCategory = tmpl.category;
      this.newTemplateScope = tmpl.taskId ? 'task' : 'general';
    },

    cancelTemplate() {
      this.showTemplateModal = false;
      this.editTemplateId = null;
      this.newTemplateName = '';
      this.newTemplateCategory = 'PRODUCTIVE';
      this.newTemplateScope = 'general';
    },

    async handleTemplateSubmit() {
      if (!this.newTemplateName.trim()) return;
      try {
        const taskId = this.newTemplateScope === 'task' ? this.selectedTaskId : null;
        if (this.editTemplateId) {
          const updated = await taskTrackerApi.updateTemplate(
            this.editTemplateId,
            this.newTemplateName.trim(),
            this.newTemplateCategory,
            taskId
          );
          const idx = this.templates.findIndex((t: any) => t.id === this.editTemplateId);
          if (idx >= 0) Object.assign(this.templates[idx], updated);
        } else {
          const tmpl = await taskTrackerApi.createTemplate(
            this.newTemplateName.trim(),
            this.newTemplateCategory,
            taskId
          );
          this.templates.unshift(tmpl);
        }
        this.showTemplateModal = false;
        this.editTemplateId = null;
        this.newTemplateName = '';
        this.newTemplateCategory = 'PRODUCTIVE';
        this.newTemplateScope = 'general';
      } catch (e) {
        console.error('Error saving template:', e);
      }
    },

    async deleteTemplate(templateId: number) {
      if (!confirm('Удалить этот шаблон?')) return;
      try {
        await taskTrackerApi.deleteTemplate(templateId);
        this.templates = this.templates.filter((t: any) => t.id !== templateId);
      } catch (e) {
        console.error('Error deleting template:', e);
      }
    },
  },
};
</script>
