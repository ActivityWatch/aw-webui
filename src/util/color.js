'use strict';

import _ from 'lodash';
const Color = require('color');
const d3 = require('d3');

// See here for examples:
//   https://bl.ocks.org/pstuffa/3393ff2711a53975040077b7453781a9

const scale = d3.scaleOrdinal(['#90CAF9', '#FFE082', '#EF9A9A', '#A5D6A7']);

// Needed to prewarm the color table
scale.domain([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

const customColors = {
  afk: '#EEE',
  'not-afk': '#7F6',
  hibernating: '#DD6',

  'google-chrome': '#6AA7FE', // Google Blue: "#4885ed"
  chromium: '#8CF', // Google Blue: "#4885ed"
  firefox: '#F94', // Firefox Orange: "#E55B0A"
  spotify: '#5FA', // Spotify Green: "#1ED760"
  alacritty: '#FD8',

  vue: '#5d9', // Vue teal #4fc08d
  python: '#369', // Python blue #2b5b84
  javascript: '#f6b', // JavaScript pink #eb47a5

  // Developer domains
  localhost: '#CCC',
  'github.com': '#EBF',
  'stackoverflow.com': Color('#F48024').lighten(0.3),

  'google.com': '#0AF',
  'google.se': '#0AF',

  // Social media sites
  'messenger.com': Color('#3b5998').lighten(0.5),
  'facebook.com': Color('#3b5998').lighten(0.5),
};

function hashcode(str) {
  let hash = 0;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const character = str.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

export function getColorFromString(appname) {
  appname = appname || '';
  appname = appname.toLowerCase();
  return customColors[appname] || scale(Math.abs(hashcode(appname) % 20));
}

export function getTitleAttr(bucket, e) {
  if (bucket.type == 'currentwindow') {
    return e.data.app;
  } else if (bucket.type == 'web.tab.current') {
    try {
      return new URL(e.data.url).hostname.replace('www.', '');
    } catch (err) {
      return e.data.url;
    }
  } else if (bucket.type == 'afkstatus') {
    return e.data.status;
  } else if (bucket.type.startsWith('app.editor')) {
    return _.last(e.data.file.split('/'));
  } else if (bucket.type.startsWith('general.stopwatch')) {
    return e.data.label;
  } else {
    return e.data.title;
  }
}
