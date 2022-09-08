import _ from 'lodash';
import { IEvent } from './interfaces';

const level_sep = '>';
const CLASSIFY_KEYS = ['app', 'title'];
const UNCATEGORIZED = ['Uncategorized'];

export interface Rule {
  type: 'regex' | 'none';
  regex?: string;
  ignore_case?: boolean;
}

export interface Category {
  id?: number;
  name: string[];
  name_pretty?: string;
  subname?: string;
  rule: Rule;
  data?: Record<string, any>;
  depth?: number;
  parent?: string[];
  children?: Category[];
}

const COLOR_UNCAT = '#CCC';

// The default categories
// Should be run through createMissingParents before being used in most cases.
export const defaultCategories: Category[] = [
  {
    name: ['Work'],
    rule: { type: 'regex', regex: 'Google Docs|libreoffice|ReText' },
    data: { color: '#0F0' },
  },
  {
    name: ['Work', 'Programming'],
    rule: {
      type: 'regex',
      regex: 'GitHub|Stack Overflow|BitBucket|Gitlab|vim|Spyder|kate|Ghidra|Scite',
    },
  },
  {
    name: ['Work', 'Programming', 'ActivityWatch'],
    rule: { type: 'regex', regex: 'ActivityWatch|aw-', ignore_case: true },
  },
  { name: ['Work', 'Image'], rule: { type: 'regex', regex: 'Gimp|Inkscape' } },
  { name: ['Work', 'Video'], rule: { type: 'regex', regex: 'Kdenlive' } },
  { name: ['Work', 'Audio'], rule: { type: 'regex', regex: 'Audacity' } },
  { name: ['Work', '3D'], rule: { type: 'regex', regex: 'Blender' } },
  {
    name: ['Media', 'Games'],
    rule: { type: 'regex', regex: 'Minecraft|RimWorld' },
    data: { color: '#F80' },
  },
  {
    name: ['Media', 'Video'],
    rule: { type: 'regex', regex: 'YouTube|Plex|VLC' },
    data: { color: '#F33' },
  },
  {
    name: ['Media', 'Social Media'],
    rule: {
      type: 'regex',
      regex: 'reddit|Facebook|Twitter|Instagram|devRant',
      ignore_case: true,
    },
    data: { color: '#FCC400' },
  },
  {
    name: ['Media', 'Music'],
    rule: {
      type: 'regex',
      regex: 'Spotify|Deezer',
      ignore_case: true,
    },
    data: { color: '#A8FC00' },
  },
  {
    name: ['Comms'],
    rule: { type: null },
    data: { color: '#9FF' },
  },
  {
    name: ['Comms', 'IM'],
    rule: {
      type: 'regex',
      regex: 'Messenger|Telegram|Signal|WhatsApp|Rambox|Slack|Riot|Element|Discord|Nheko',
    },
  },
  { name: ['Comms', 'Email'], rule: { type: 'regex', regex: 'Gmail|Thunderbird|mutt|alpine' } },
  { name: ['Uncategorized'], rule: { type: null }, data: { color: COLOR_UNCAT } },
];

export function annotate(c: Category) {
  const ch = c.name;
  c.name_pretty = ch.join(level_sep);
  c.subname = ch.slice(-1)[0];
  c.parent = ch.length > 1 ? ch.slice(0, -1) : null;
  c.depth = ch.length - 1;
  return c;
}

export function createMissingParents(classes: Category[]): Category[] {
  // Creates parents for categories that are missing theirs (implicit parents)
  classes = _.cloneDeep(classes);
  classes = classes.slice().map(c => annotate(c));
  const all_full_names = new Set(classes.map(c => c.name.join(level_sep)));

  function _createMissing(children: Category[]) {
    children
      .map(c => c.parent)
      .filter(p => !!p)
      .map(p => {
        const name = p.join(level_sep);
        if (p && !all_full_names.has(name)) {
          const new_parent = annotate({ name: p, rule: { type: null } });
          //console.log('Creating missing parent:', new_parent);
          classes.push(new_parent);
          all_full_names.add(name);
          // New parent might not be top-level, so we need to recurse
          _createMissing([new_parent]);
        }
      });
  }

  _createMissing(classes);
  return classes;
}

export function build_category_hierarchy(classes: Category[]): Category[] {
  classes = createMissingParents(classes);

  function assignChildren(classes_at_level: Category[]) {
    return classes_at_level.map(cls => {
      cls.children = classes.filter(child => {
        return child.parent && cls.name
          ? JSON.stringify(child.parent) == JSON.stringify(cls.name)
          : false;
      });
      assignChildren(cls.children);
      return cls;
    });
  }

  return assignChildren(classes.filter(c => !c.parent));
}

export function flatten_category_hierarchy(hier: Category[]): Category[] {
  return _.flattenDeep(
    hier.map(h => {
      const level = [h, flatten_category_hierarchy(h.children)];
      h.children = [];
      return level;
    })
  );
}

function areWeTesting() {
  return process.env.NODE_ENV === 'test';
}

export function saveClasses(classes: Category[]) {
  if (areWeTesting()) {
    console.log('Not saving classes in test mode');
    return;
  }
  localStorage.classes = JSON.stringify(classes.map(cleanCategory));
  console.log('Saved classes', localStorage.classes);
}

export function cleanCategory(cat: Category): Category {
  cat = _.cloneDeep(cat);
  delete cat.children;
  delete cat.parent;
  delete cat.subname;
  delete cat.name_pretty;
  delete cat.depth;
  return cat;
}

export function loadClasses(): Category[] {
  const classes_json = localStorage.classes;
  if (classes_json && classes_json.length >= 1) {
    return JSON.parse(classes_json).map(cleanCategory);
  } else {
    return defaultCategories;
  }
}

function pickDeepest(categories: Category[]) {
  return _.maxBy(categories, c => c.name.length);
}

export function matchString(str: string, categories: Category[] | null): Category | null {
  if (!categories) {
    console.log(
      'Categories not passed, loading... (if you see this outside of a test, you should probably pass them)'
    );
    categories = loadClasses();
  }

  // Compile regexes
  const regexes: [Category, RegExp][] = categories
    .filter(c => c.rule.type == 'regex')
    .map(c => {
      const re = RegExp(c.rule.regex, c.rule.ignore_case ? 'i' : '');
      return [c, re];
    });

  // Find the matching category.
  // If several categories match the event, the deepest category will be chosen.
  const matchingCats: [Category, RegExp][] = regexes.filter(c => c[1].test(str));
  if (matchingCats.length > 0) {
    return pickDeepest(matchingCats.map(c => c[0]));
  }
  return null;
}

export function classifyEvents(events: IEvent[], categories: Category[]): IEvent[] {
  // Compile regexes
  const regexes: [Category, RegExp][] = categories
    .filter(c => c.rule.type == 'regex')
    .map(c => {
      const re = RegExp(c.rule.regex, c.rule.ignore_case ? 'i' : '');
      return [c, re];
    });

  // Classify events using compiled regexes.
  // If several categories match the event, the deepest category will be chosen.
  return events.map((e: IEvent) => {
    const matchingCats: [Category, RegExp][] = regexes.filter(c => {
      return _.map(CLASSIFY_KEYS, key => c[1].test(e.data[key])).some(x => x);
    });
    if (matchingCats.length > 0) {
      const category = pickDeepest(matchingCats.map(c => c[0]));
      e.data.$category = category.name;
    } else {
      e.data.$category = UNCATEGORIZED;
    }
    return e;
  });
}
