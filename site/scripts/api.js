// This file should not have any external dependencies within the project
// Will hopefully be extracted into a separate module later on

HOST = "http://localhost:5000"

function get_clients() {
    return $.getJSON(HOST + "/api/0/clients")
}

function get_activities(activity_type) {
    return $.getJSON(HOST + "/api/0/activity/" + activity_type)
}


function test() {
    get_clients().done(function (clients) {
        console.log("aw-server watcher has " + clients.length + " clients");
        console.log(clients);
    });

    get_activities("afkwatcher").done(function (activities) {
        console.log("AFK watcher had " + activities.length + " activities");
        console.log(activities);
    });
}

test()
