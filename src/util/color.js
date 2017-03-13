const Color = require("color");

/*
    Color generation
    ================
    Each app has its own color in app_colors
    The first 4 apps get the 4 default colors
    The preceeding apps get a mix in the order of 1+0,2+0,2+1,3+0,3+1,3+2...
*/
var colors = [Color('#90CAF9'), Color('#FFE082'), Color('#EF9A9A'), Color('#A5D6A7')];
let app_colors = {};

function calculateNextColor() {
  var color1 = colors[(colors.length >> 1)-1];
  var color2 = colors[colors.length%(colors.length >> 1)];

  // Now mix the two
  var color = Color({
    r: (color1.rgb().r+color2.rgb().r)/2,
    g: (color1.rgb().g+color2.rgb().g)/2,
    b: (color1.rgb().b+color2.rgb().b)/2
  });

  colors[Object.keys(app_colors).length] = color;
}

function getAppColor(appname) {
  if(!(appname in app_colors)) {
    if (colors.length == Object.keys(app_colors).length){
      calculateNextColor();
    }
    app_colors[appname] = colors[Object.keys(app_colors).length]
  }
  return app_colors[appname].rgbString();
}

module.exports = {
    getAppColor: getAppColor
};
