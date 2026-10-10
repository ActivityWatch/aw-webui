import { defineStore } from 'pinia';
import { useSettingsStore } from './settings';

interface IElement {
  type: string;
  size?: number;
  props?: Record<string, unknown>;
}

export interface View {
  id: string;
  name: string;
  elements: IElement[];
}

const desktopViews: View[] = [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
      { type: 'timeline_barchart', size: 3 },
      { type: 'top_categories', size: 3 },
      { type: 'category_tree', size: 3 },
      { type: 'category_sunburst', size: 3 },
    ],
  },
  {
    id: 'window',
    name: 'Window',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
    ],
  },
  {
    id: 'browser',
    name: 'Browser',
    elements: [
      { type: 'top_domains', size: 3 },
      { type: 'top_urls', size: 3 },
      { type: 'top_browser_titles', size: 3 },
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    elements: [
      { type: 'top_editor_files', size: 3 },
      { type: 'top_editor_projects', size: 3 },
      { type: 'top_editor_languages', size: 3 },
    ],
  },
];

export const androidViews: View[] = [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_categories', size: 3 },
      { type: 'timeline_barchart', size: 3 },
      { type: 'category_tree', size: 3 },
      { type: 'category_sunburst', size: 3 },
    ],
  },
];

const onAndroid = Boolean(process.env.VUE_APP_ON_ANDROID);

export const defaultViews = onAndroid ? androidViews : desktopViews;

// Desktop defaults that Android builds persisted by mistake. From the ESM config
// switch until #1061, `--os=android` was ignored, so Android shipped
// `desktopViews` as its default, and `settings.save()` writes every key, so any
// settings change stored them on the server. The first entry is the layout
// before `top_browser_titles` was added (#631). Keep this historical snapshot
// independent of desktopViews, so later default changes do not change matching.
const LEGACY_DESKTOP_WITH_BROWSER_TITLES: View[] = [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
      { type: 'timeline_barchart', size: 3 },
      { type: 'top_categories', size: 3 },
      { type: 'category_tree', size: 3 },
      { type: 'category_sunburst', size: 3 },
    ],
  },
  {
    id: 'window',
    name: 'Window',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
    ],
  },
  {
    id: 'browser',
    name: 'Browser',
    elements: [
      { type: 'top_domains', size: 3 },
      { type: 'top_urls', size: 3 },
      { type: 'top_browser_titles', size: 3 },
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    elements: [
      { type: 'top_editor_files', size: 3 },
      { type: 'top_editor_projects', size: 3 },
      { type: 'top_editor_languages', size: 3 },
    ],
  },
];
const LEGACY_DESKTOP_DEFAULTS: View[][] = [
  LEGACY_DESKTOP_WITH_BROWSER_TITLES.map(view =>
    view.id === 'browser'
      ? { ...view, elements: view.elements.filter(el => el.type !== 'top_browser_titles') }
      : view
  ),
  LEGACY_DESKTOP_WITH_BROWSER_TITLES,
];

function sameLayout(a: View[], b: View[]): boolean {
  return (
    a.length === b.length &&
    a.every((view, i) => {
      const other = b[i];
      return (
        view.id === other.id &&
        view.name === other.name &&
        Array.isArray(view.elements) &&
        view.elements.length === other.elements.length &&
        view.elements.every(
          (el, j) =>
            el.type === other.elements[j].type &&
            el.size === other.elements[j].size &&
            el.props === undefined
        )
      );
    })
  );
}

/**
 * On Android, replace stored views that are an unmodified desktop default with
 * the Android defaults (aw-android#321). Views the user edited are kept.
 */
export function migrateStoredViews(stored: View[], isAndroid: boolean = onAndroid): View[] {
  if (!isAndroid || !Array.isArray(stored)) {
    return stored;
  }
  if (!LEGACY_DESKTOP_DEFAULTS.some(legacy => sameLayout(stored, legacy))) {
    return stored;
  }
  // A copy, so later view edits don't mutate the shared default.
  return JSON.parse(JSON.stringify(androidViews));
}

interface State {
  views: View[];
}

export const useViewsStore = defineStore('views', {
  state: (): State => ({
    views: [],
  }),
  getters: {
    getViewById: state => (id: string) => state.views.find(view => view.id === id),
  },
  actions: {
    async load() {
      const settingsStore = useSettingsStore();
      await settingsStore.ensureLoaded();
      const views = migrateStoredViews(settingsStore.views);
      this.loadViews(views);
    },
    async save() {
      const settingsStore = useSettingsStore();
      settingsStore.update({ views: this.views });
      await this.load();
    },
    loadViews(views: View[]) {
      this.$patch({ views });
      console.log('Loaded views:', this.views);
    },
    clearViews(this: State) {
      this.views = [];
    },
    setElements(this: State, { view_id, elements }: { view_id: string; elements: IElement[] }) {
      this.views.find(v => v.id == view_id).elements = elements;
    },
    restoreDefaults(this: State) {
      this.views = defaultViews;
    },
    viewsForHost(_host: string): View[] {
      return this.views;
    },
    addView(this: State, view: View) {
      this.views.push({ ...view, elements: [] });
    },
    removeView(this: State, { view_id }) {
      const idx = this.views.map(v => v.id).indexOf(view_id);
      this.views.splice(idx, 1);
    },
    editView(
      this: State,
      {
        view_id,
        el_id,
        type,
        props,
      }: { view_id: string; el_id: string; type: string; props: Record<string, unknown> }
    ) {
      console.log(view_id, el_id, type, props);
      console.log(this.views);
      const element = this.views.find(v => v.id == view_id).elements[el_id];
      element.type = type;
      element.props = props;
    },
    addVisualization(this: State, { view_id, type }) {
      this.views.find(v => v.id == view_id).elements.push({ type: type });
    },
    removeVisualization(this: State, { view_id, el_id }) {
      this.views.find(v => v.id == view_id).elements.splice(el_id, 1);
    },
  },
});
