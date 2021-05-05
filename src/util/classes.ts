import _ from 'lodash';

const level_sep = '>';

interface Rule {
  type: string;
  regex?: string;
  ignore_case?: boolean;
  select_keys?: string[];
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

// https://colorhunt.co/palette/4802
const COLOR_GREEN = '#96cd39',
  COLOR_SUPER_GREEN = '#54e346',
  COLOR_UNCAT = '#CCC',
  COLOR_ORANGE_GREEN = '#f5ff65',
  COLOR_ORANGE = '#ffba47',
  COLOR_RED = '#ff5b44';

// The default categories
// Should be run through createMissingParents before being used in most cases.
export const defaultCategories: Category[] = [
  {
    name: ['Work', 'Writing'],
    rule: { type: 'regex', regex: 'Google Docs|Google Sheets|libreoffice|ReText|TextEdit|MacDown' },
    data: { color: COLOR_GREEN },
  },
  {
    name: ['Work', 'Writing'],
    rule: { type: 'regex', select_keys: ['app'], regex: 'LibreOffice|TextEdit|MacDown' },
    data: { color: COLOR_GREEN },
  },
  {
    name: ['Work', 'General'],
    rule: { type: 'regex', regex: 'Preview|Finder|Todoist|1Password|Soulver' },
    data: { color: COLOR_ORANGE_GREEN },
  },
  {
    name: ['Work', 'Programming'],
    rule: {
      type: 'regex',
      regex: 'GitHub|Stack Overflow|BitBucket|Gitlab|vim|Spyder|kate|iTerm|Script Editor',
    },
    data: { color: COLOR_SUPER_GREEN },
  },
  {
    name: ['Work', 'Programming'],
    rule: { type: 'regex', select_keys: ['url'], regex: 'github.com' },
    data: { color: COLOR_SUPER_GREEN },
  },
  {
    name: ['Work', 'Programming'],
    rule: {
      type: 'regex',
      select_keys: ['app'],
      regex: 'Code|Sublime Text|TextMate|iTerm|Script Editor|Base',
    },
    data: { color: COLOR_SUPER_GREEN },
  },
  {
    name: ['Work', 'Programming', 'ActivityWatch'],
    rule: { type: 'regex', regex: 'ActivityWatch|aw-', ignore_case: true },
    data: { color: COLOR_SUPER_GREEN },
  },
  {
    name: ['Media', 'Games'],
    rule: { type: 'regex', regex: 'Minecraft|RimWorld' },
    data: { color: COLOR_RED },
  },
  {
    name: ['Media', 'Video'],
    rule: { type: 'regex', regex: 'YouTube|Plex|VLC' },
    data: { color: COLOR_RED },
  },
  {
    name: ['Media', 'Social Media'],
    rule: {
      type: 'regex',
      regex: 'reddit|Facebook|Twitter|Instagram|devRant|LinkedIn',
      ignore_case: true,
    },
    data: { color: COLOR_RED },
  },
  {
    name: ['Media', 'Music'],
    rule: { type: 'regex', regex: 'Spotify|Deezer|Amazon Music' },
    data: { color: COLOR_RED },
  },
  {
    name: ['Comms', 'IM'],
    rule: {
      type: 'regex',
      regex:
        'Messenger|Messages|Discord|Telegram|Signal|WhatsApp|Rambox|Slack|Riot|Discord|Textual',
    },
    data: { color: COLOR_ORANGE },
  },
  {
    name: ['Comms', 'Email'],
    rule: { type: 'regex', regex: 'Gmail|Thunderbird|mutt|alpine' },
    data: { color: COLOR_ORANGE },
  },
  {
    name: ['Comms', 'Meetings'],
    rule: { type: 'regex', regex: 'Zoom|Calendar' },
    data: { color: COLOR_ORANGE_GREEN },
  },
  {
    name: ['Web Browsing'],
    rule: { type: 'regex', regex: 'Chrome|Safari|FireFox|Brave', select_keys: ['app'] },
  },
  { name: ['Uncategorized'], rule: { type: null }, data: { color: COLOR_UNCAT } },
];

function annotate(c: Category) {
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

// TODO this is only used colorize the categories, all categorization is done on the backend
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

  if (matchingCats.length > 0) {
    return pickDeepest(matchingCats);
  }

  return null;
}
