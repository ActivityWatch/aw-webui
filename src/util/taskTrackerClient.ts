/**
 * Task Tracker API client — wraps the /api/0/task-tracker/ endpoints.
 */

async function apiFetch(path: string, init?: RequestInit): Promise<any> {
  // Use relative URL — the web UI is served from the same origin as the API
  const url = `/api/0/task-tracker${path}`;

  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  // 204 or empty body
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const taskTrackerApi = {
  /* ── Tasks ── */

  async getTasks(): Promise<any[]> {
    return apiFetch('/tasks');
  },

  async createTask(name: string, description?: string): Promise<any> {
    return apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  async deleteTask(taskId: number): Promise<void> {
    return apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
  },

  /* ── Task selection ── */

  async selectTask(taskId: number): Promise<any> {
    return apiFetch(`/tasks/${taskId}/select`, { method: 'POST' });
  },

  async deselectTask(taskId: number): Promise<void> {
    return apiFetch(`/tasks/${taskId}/deselect`, { method: 'POST' });
  },

  /* ── Time entries ── */

  async getTimeEntries(taskId: number): Promise<any[]> {
    return apiFetch(`/tasks/${taskId}/time-entries`);
  },

  /* ── App usages ── */

  async getAppUsages(taskId: number): Promise<any[]> {
    return apiFetch(`/tasks/${taskId}/app-usages`);
  },

  async updateAppCategory(
    taskId: number,
    appUsageId: number,
    category: string
  ): Promise<any> {
    return apiFetch(`/tasks/${taskId}/app-usages`, {
      method: 'PUT',
      body: JSON.stringify({ appUsageId, category }),
    });
  },

  /* ── ActivityWatch sync ── */

  async syncActivityWatch(taskId: number): Promise<any[]> {
    return apiFetch(`/activity-watch?taskId=${taskId}`);
  },

  /* ── Templates ── */

  async getTemplates(): Promise<any[]> {
    return apiFetch('/templates');
  },

  async createTemplate(name: string, category?: string, taskId?: number | null): Promise<any> {
    return apiFetch('/templates', {
      method: 'POST',
      body: JSON.stringify({ name, category, taskId: taskId ?? null }),
    });
  },

  async updateTemplate(
    templateId: number,
    name?: string,
    category?: string,
    taskId?: number | null
  ): Promise<any> {
    return apiFetch(`/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, category, taskId: taskId ?? null }),
    });
  },

  async deleteTemplate(templateId: number): Promise<void> {
    return apiFetch(`/templates/${templateId}`, { method: 'DELETE' });
  },
};
