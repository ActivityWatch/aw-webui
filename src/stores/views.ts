import { defineStore } from 'pinia';
import { translate, t } from '~/i18n';
import { useSettingsStore } from './settings';

interface IElement {
  type: string;
  size?: number;
  props?: Record<string, unknown>;
}

export interface View {
  id: string;
  name?: string;
  nameKey?: string;
  elements: IElement[];
}

const desktopViews: View[] = [
  {
    id: 'summary',
    name: 'Summary',
    nameKey: 'views.summary',
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
    nameKey: 'views.window',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
    ],
  },
  {
    id: 'browser',
    name: 'Browser',
    nameKey: 'views.browser',
    elements: [
      { type: 'top_domains', size: 3 },
      { type: 'top_urls', size: 3 },
      { type: 'top_browser_titles', size: 3 },
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    nameKey: 'views.editor',
    elements: [
      { type: 'top_editor_files', size: 3 },
      { type: 'top_editor_projects', size: 3 },
      { type: 'top_editor_languages', size: 3 },
    ],
  },
];

const androidViews = [
  {
    id: 'summary',
    name: 'Summary',
    nameKey: 'views.summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_categories', size: 3 },
      { type: 'timeline_barchart', size: 3 },
      { type: 'category_tree', size: 3 },
      { type: 'category_sunburst', size: 3 },
    ],
  },
];

// FIXME: Decide depending on what kind of device is being viewed, not from which device it is being viewed from.
export const defaultViews = !process.env.VUE_APP_ON_ANDROID ? desktopViews : androidViews;

interface State {
  views: View[];
}

function localizeView(view: View): View {
  return {
    ...view,
    elements: view.elements.map(element => ({ ...element })),
    name: view.nameKey ? t(view.nameKey) : view.name,
  };
}

function serializeView(view: View): View {
  return {
    ...view,
    elements: view.elements.map(element => ({ ...element })),
    name: view.nameKey ? translate(view.nameKey, 'en') : view.name,
  };
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
      const views = settingsStore.views;
      this.loadViews(views);
    },
    async save() {
      const settingsStore = useSettingsStore();
      await settingsStore.update({ views: this.views.map(serializeView) });
      await this.load();
    },
    loadViews(views: View[]) {
      this.$patch({ views: views.map(localizeView) });
      console.log('Loaded views:', this.views);
    },
    clearViews(this: State) {
      this.views = [];
    },
    setElements(this: State, { view_id, elements }: { view_id: string; elements: IElement[] }) {
      this.views.find(v => v.id == view_id).elements = elements;
    },
    restoreDefaults(this: State) {
      this.views = defaultViews.map(localizeView);
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
