/*

   Show_hide

   To make a dropdown, set the dropdown button to class dropdown-btn and the dropdown content to class dropdown-content and call show on-click on the button

   To toggle show/hide, simply call the show_hide function

*/

function show(id){
    var elem = document.getElementById(id);
    elem.style.display = "";
}


function hide(id){
    var elem = document.getElementById(id);
    elem.style.display = "none";
}

function show_hide(id){
    var elem = document.getElementById(id);
    if (elem.style.display == "")
      hide(id);
    else
      show(id);
}

window.onload = function(){
  var dropdowns = document.getElementsByClassName("dropdown-content");
  var i;
  for (i = 0; i < dropdowns.length; i++) {
    var openDropdown = dropdowns[i];
    if (openDropdown.style.display != "none") {
      hide(openDropdown.id);
    }
  }
}

window.onclick = function(event) {
  if (!event.target.matches('.dropdown-btn')){
    var dropdowns = document.getElementsByClassName("dropdown-content");
    var i;
    for (i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.style.display != "none") {
        hide(openDropdown.id);
      }
    }
  }
}

module.exports = {
    show: show,
    hide: hide,
    show_hide: show_hide,
}
