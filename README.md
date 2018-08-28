aw-webui
========

> A webui for ActivityWatch built in Vue.js

[![Build Status](https://travis-ci.org/ActivityWatch/aw-webui.svg?branch=master)](https://travis-ci.org/ActivityWatch/aw-webui)


## Build Setup

``` bash
# Install dependencies
make install

# Make sure you have aw-server running, the testing port will be used by default
# so make sure you are running with the --testing flag
aw-server --testing

# serve with hot reload at localhost:27180
npm run dev

# build for production with minification
npm run build
```

For development you'll also have to add/change CORS configuration in the
aw-server config by adding `cors_origins = http://localhost:27180` to your
configuration file `~/.config/activitywatch/aw-server/aw-server.ini` under the
`server-testing` section.

## Code structure

One of the first things that happen in the application is the execution of `src/main.js`.

This loads things such as bootstrap-vue and a bunch of other stuff that's globally used (filters, resources).

The main.js file then loads the `src/App.vue` file, which is the root component of the application.

This repo was initialized with a Vue.js template that uses webpack, so for detailed explanation on how things work, checkout the [guide](http://vuejs-templates.github.io/webpack/) and [docs for vue-loader](http://vuejs.github.io/vue-loader).

