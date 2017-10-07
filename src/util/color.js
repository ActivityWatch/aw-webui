'use strict';

const d3 = require("d3");

// See here for examples:
//   https://bl.ocks.org/pstuffa/3393ff2711a53975040077b7453781a9

let scale = d3.scaleOrdinal(['#90CAF9', '#FFE082', '#EF9A9A', '#A5D6A7']);

// Needed to prewarm the color table
scale.domain([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

let customColors = {
    "afk": "#DDD",
    "not-afk": "#2D6",
    "hibernating": "#DD6",

    "google-chrome": "#4885ed",   // Google Blue
    "chromium": "#4885ed", // Google Blue
    "spotify": "#1ED760",  // Spotify Green
    "alacritty": "#EA5"
};

function hashcode(str){
    let hash = 0;
    if (str.length === 0) {
      return hash;
    }
    for (var i = 0; i < str.length; i++) {
        var character = str.charCodeAt(i);
        hash = ((hash<<5)-hash)+character;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

function getColorFromString(appname) {
    appname = appname || "";
    appname = appname.toLowerCase();
    return customColors[appname] || scale(Math.abs(hashcode(appname) % 20));
}

module.exports = {
    getAppColor: getColorFromString,
    getColorFromString: getColorFromString
};
