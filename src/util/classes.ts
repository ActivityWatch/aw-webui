const _ = require('lodash');

interface Rule {
  type: string;
  regex?: string;
  ignore_case?: boolean;
}

interface Category {
  id: number;
  parentId?: number;
  name: string[];
  subname?: string;
  rule: Rule;
  depth?: number;
  children?: Category[];
}

export const defaultCategories: Category[] = [
  { id: 0, name: ['Work'], rule: { type: 'regex', regex: 'Google Docs|libreoffice|ReText' } },
  {
    id: 1,
    parentId: 0,
    name: ['Work', 'Programming'],
    rule: { type: 'regex', regex: 'GitHub|Stack Overflow|BitBucket|Gitlab|vim|Spyder|kate' },
  },
  {
    id: 2,
    parentId: 1,
    name: ['Work', 'Programming', 'ActivityWatch'],
    rule: { type: 'regex', regex: 'ActivityWatch|aw-', ignore_case: true },
  },
  { name: ['Media'], rule: { type: null }, id: 3 },
  {
    id: 4,
    parentId: 3,
    name: ['Media', 'Games'],
    rule: { type: 'regex', regex: 'Minecraft|RimWorld' },
  },
  {
    id: 5,
    parentId: 3,
    name: ['Media', 'Video'],
    rule: { type: 'regex', regex: 'YouTube|Plex|VLC' },
  },
  {
    id: 6,
    parentId: 3,
    name: ['Media', 'Social Media'],
    rule: { type: 'regex', regex: 'reddit|Facebook|Twitter|Instagram|devRant', ignore_case: true },
  },
  {
    id: 7,
    parentId: 3,
    name: ['Media', 'Music'],
    rule: { type: 'regex', regex: 'Spotify|Deezer', ignore_case: true },
  },
  { id: 8, name: ['Comms'], rule: { type: null } },
  {
    id: 9,
    parentId: 8,
    name: ['Comms', 'IM'],
    rule: { type: 'regex', regex: 'Messenger|Telegram|Signal|WhatsApp|Rambox|Slack|Riot|Discord' },
  },
  {
    id: 10,
    parentId: 8,
    name: ['Comms', 'Email'],
    rule: { type: 'regex', regex: 'Gmail|Thunderbird|mutt|alpine' },
  },
];

export function build_category_hierarchy(classes: Category[]): Category[] {
  function annotate(c: Category) {
    const ch = c.name;
    // Use -1 as parentId if no parent
    c.parentId = c.parentId !== undefined ? c.parentId : -1;
    c.subname = ch.slice(-1)[0];
    c.depth = ch.length - 1;
    return c;
  }

  classes.map(c => annotate(c));

  function assignChildren(classes_at_level: Category[]) {
    return classes_at_level.map(cls => {
      cls.children = classes.filter(child => {
        return child.parentId == cls.id;
      });
      assignChildren(cls.children);
      return cls;
    });
  }

  return assignChildren(classes.filter(c => c.parentId === -1));
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
