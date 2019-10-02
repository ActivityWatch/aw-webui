// TODO: This would work better as a vuex store
let _ = require('lodash');

export let defaultClasses = [
  { name: '#test-tag', rule: { type: 'regex', pattern: 'test' } },
  { name: 'Test category -> subcategory', rule: { type: 'regex', pattern: 'test' } },
  { name: 'Work', rule: { type: 'regex', pattern: '[Aa]lacritty|Google Docs' } },
  {
    name: 'Work -> Programming',
    rule: { type: 'regex', pattern: '\\~/Programming|[Pp]ython|GitHub' },
  },
  {
    name: 'Work -> Programming -> ActivityWatch',
    rule: { type: 'regex', pattern: '[Aa]ctivity[Ww]atch|aw-' },
  },
  { name: 'Media -> Games', rule: { type: 'regex', pattern: 'Minecraft|RimWorld' } },
  { name: 'Media -> Video', rule: { type: 'regex', pattern: 'YouTube|Plex' } },
  { name: 'Media -> Social Media', rule: { type: 'regex', pattern: 'reddit|Facebook|Twitter' } },
  { name: 'Comms -> IM', rule: { type: 'regex', pattern: 'Messenger' } },
  { name: 'Comms -> Email', rule: { type: 'regex', pattern: 'Gmail' } },
];

export let defaultCategories = [
  { name: '#test-tag', rule: { type: 'regex', pattern: 'test' } },
  { name: 'Test category -> subcategory', rule: { type: 'regex', pattern: 'test' } },
  {
    name: 'Work',
    rule: { type: 'regex', pattern: '[Aa]lacritty|Google Docs' },
    children: [
      {
        name: 'Programming',
        rule: { type: 'regex', pattern: '\\~/Programming|[Pp]ython|GitHub' },
        children: [
          {
            name: 'ActivityWatch',
            rule: { type: 'regex', pattern: '[Aa]ctivity[Ww]atch|aw-' },
          },
        ],
      },
    ],
  },
  {
    name: 'Media',
    children: [
      { name: 'Media -> Games', rule: { type: 'regex', pattern: 'Minecraft|RimWorld' } },
      { name: 'Media -> Video', rule: { type: 'regex', pattern: 'YouTube|Plex' } },
      {
        name: 'Media -> Social Media',
        rule: { type: 'regex', pattern: 'reddit|Facebook|Twitter' },
      },
    ],
  },
  {
    name: 'Comms',
    children: [
      { name: 'IM', rule: { type: 'regex', pattern: 'Messenger' } },
      { name: 'Email', rule: { type: 'regex', pattern: 'Gmail' } },
    ],
  },
];

export function build_category_hierarchy(classes: List[cls]) {
  function annotateClass(c) {
    let ch = c.name.split('->').map(s => s.trim());
    c.name = ch.join('->');
    c.subname = ch.slice(-1)[0];
    c.full_name = ch;
    c.parent = ch.length > 1 ? ch.slice(0, -1) : null;
    c.depth = ch.length - 1;
    return c;
  }

  let new_classes = classes.slice().map(c => annotateClass(c));

  // Insert dangling/undefined parents
  let all_full_names = new Set(new_classes.map(c => c.full_name.join('->')));
  new_classes
    .map(c => c.parent)
    .filter(p => !!p)
    .map(p => {
      let name = p.join('->');
      if (p && !all_full_names.has(name)) {
        let new_parent = annotateClass({ name: name, rule: { type: null, pattern: '' } });
        classes.push(new_parent);
        all_full_names.add(name);
      }
    });

  function assignChildren(classes_at_level) {
    return classes_at_level.map(cls => {
      cls.children = classes.filter(child => {
        return child.parent && cls.full_name
          ? JSON.stringify(child.parent) == JSON.stringify(cls.full_name)
          : false;
      });
      assignChildren(cls.children);
      return cls;
    });
  }

  return assignChildren(classes.filter(c => !c.parent));
}

export function flatten_category_hierarchy(hier) {
  return _.flattenDeep(
    hier.map(h => {
      let level = [h, flatten_category_hierarchy(h.children)];
      h.children = [];
      return level;
    })
  );
}

export function saveClasses(classes) {
  localStorage.classes = JSON.stringify(classes);
  console.log('Saved classes', localStorage.classes);
}

export function loadClasses() {
  let classes = JSON.parse(localStorage.classes);
  console.log(classes);
  if (classes.length < 1) {
    console.log('Entered if');
    classes = defaultClasses;
  }
  return classes;
}

export function loadClassesForQuery() {
  return loadClasses().map(c => [c.name, c.rule.pattern]);
}
