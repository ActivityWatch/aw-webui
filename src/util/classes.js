// TODO: This would work better as a vuex store

export let defaultClasses = [
  { name: '#test', re: 'test' },
  { name: 'Work', re: '[Aa]lacritty|Google Docs' },
  { name: 'Work -> Programming', re: '\\~/Programming|[Pp]ython|GitHub' },
  { name: 'Work -> Programming -> ActivityWatch', re: '[Aa]ctivity[Ww]atch|aw-' },
  { name: 'Media -> Games', re: 'RimWorld' },
  { name: 'Media -> Video', re: 'YouTube' },
  { name: 'Media -> Social Media', re: 'reddit|Facebook|Twitter' },
  { name: 'Remote', re: 'Shadow' },
  { name: 'Comms -> IM', re: 'Messenger' },
  { name: 'Comms -> Email', re: 'Gmail' },
];

export function saveClasses(classes) {
  localStorage.classes = JSON.stringify(classes);
  console.log('Saved classes', localStorage.classes);
}

export function resetClasses() {
  localStorage.classes = JSON.stringify(defaultClasses);
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
  return loadClasses().map(c => [c.name, c.re]);
}
