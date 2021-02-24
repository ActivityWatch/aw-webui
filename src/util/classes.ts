const _ = require('lodash');

const level_sep = '>';

interface Rule {
  type: string;
  regex?: string;
  ignore_case?: boolean;
}

export interface Category {
  id?: number;
  name: string[];
  name_pretty?: string;
  subname?: string;
  rule: Rule;
  data?: any;
  depth?: number;
  parent?: string[];
  children?: Category[];
}

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
      regex: 'GitHub|Stack Overflow|BitBucket|Gitlab|vim|Spyder|kate|Ghidra|Scite' 
    },
  },
  {
    name: ['Work', 'Programming', 'ActivityWatch'],
    rule: { type: 'regex', regex: 'ActivityWatch|aw-', ignore_case: true },
  },
  {
    name: ['Media', 'Games'],
    rule: { type: 'regex', regex: 'Minecraft|RimWorld' },
    data: { color: '#0FF' },
  },
  { name: ['Media', 'Video'], rule: { type: 'regex', regex: 'YouTube|Plex|VLC' } },
  { name: ['Media', 'Image'], rule: { type: 'regex', regex: 'Gimp|Inkscape' } },
  {
    name: ['Media', 'Social Media'],
    rule: {
      type: 'regex', 
      regex: 'reddit|Facebook|Twitter|Instagram|devRant', 
      ignore_case: true 
    },
  },
  { 
    name: ['Media', 'Music'], 
    rule: {
      type: 'regex', 
      regex: 'Spotify|Deezer|Audacity', 
      ignore_case: true 
    } 
  },
  {
    name: ['Comms', 'IM'],
    rule: { 
      type: 'regex', 
      regex: 'Messenger|Telegram|Signal|WhatsApp|Rambox|Slack|Riot|Discord|Nheko' 
    },
  },
  { name: ['Comms', 'Email'], rule: { type: 'regex', regex: 'Gmail|Thunderbird|mutt|alpine' } },
  { name: ['Uncategorized'], rule: { type: null }, data: { color: '#ccc' } },
];

export function build_category_hierarchy(classes: Category[]): Category[] {
  function annotate(c: Category) {
    const ch = c.name;
    c.name_pretty = ch.join(level_sep);
    c.subname = ch.slice(-1)[0];
    c.parent = ch.length > 1 ? ch.slice(0, -1) : null;
    c.depth = ch.length - 1;
    return c;
  }

  const new_classes = classes.slice().map(c => annotate(c));

  // Insert dangling/undefined parents
  const all_full_names = new Set(new_classes.map(c => c.name.join(level_sep)));

  function createMissingParents(children) {
    children
      .map(c => c.parent)
      .filter(p => !!p)
      .map(p => {
        const name = p.join(level_sep);
        if (p && !all_full_names.has(name)) {
          const new_parent = annotate({ name: p, rule: { type: null } });
          classes.push(new_parent);
          all_full_names.add(name);
          // New parent might not be top-level, so we need to recurse
          createMissingParents([new_parent]);
        }
      });
  }

  createMissingParents(new_classes);

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

export function saveClasses(classes: Category[]) {
  localStorage.classes = JSON.stringify(classes);
  console.log('Saved classes', localStorage.classes);
}

export function loadClasses(): Category[] {
  const classes_json = localStorage.classes;
  if (classes_json && classes_json.length >= 1) {
    return JSON.parse(classes_json);
  } else {
    return defaultCategories;
  }
}

export function loadClassesForQuery(): [string[], Rule][] {
  return loadClasses()
    .filter(c => c.rule.type !== null)
    .map(c => {
      return [c.name, c.rule];
    });
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
  const matchingCats = categories
    .filter(c => c.rule.type == 'regex')
    .filter(c => {
      const re = RegExp(c.rule.regex, c.rule.ignore_case ? 'i' : '');
      return re.test(str);
    });
  if (matchingCats.length > 0) return pickDeepest(matchingCats);
  return null;
}
