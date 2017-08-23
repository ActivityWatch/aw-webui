aw-webui
========

> A webui for ActivityWatch built in Vue.js

[![Build Status](https://travis-ci.org/ActivityWatch/aw-webui.svg?branch=master)](https://travis-ci.org/ActivityWatch/aw-webui)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bhttps%3A%2F%2Fgithub.com%2FActivityWatch%2Faw-webui.svg?type=shield)](https://app.fossa.io/projects/git%2Bhttps%3A%2F%2Fgithub.com%2FActivityWatch%2Faw-webui?ref=badge_shield)


## Build Setup

``` bash
# Install dependencies
npm install

# Make sure you have aw-server running, the testing port will be used by default
# so make sure you are running with the --testing flag
aw-server --testing

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build
```


## Code structure

One of the first things that happen in the application is the execution of `src/main.js`. 

This loads things such as bootstrap-vue and a bunch of other stuff that's globally used (filters, resources).

The main.js file then loads the `src/App.js` file, which is the root component of the application and where everything thing begins.

This repo was initialized with a Vue.js template that uses webpack, so for detailed explanation on how things work, checkout the [guide](http://vuejs-templates.github.io/webpack/) and [docs for vue-loader](http://vuejs.github.io/vue-loader).



## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bhttps%3A%2F%2Fgithub.com%2FActivityWatch%2Faw-webui.svg?type=large)](https://app.fossa.io/projects/git%2Bhttps%3A%2F%2Fgithub.com%2FActivityWatch%2Faw-webui?ref=badge_large)