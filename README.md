# aw-webui

A web-based UI for ActivityWatch, built with Vue.js

[![Build Status](https://github.com/ActivityWatch/aw-webui/workflows/Build/badge.svg)](https://github.com/ActivityWatch/aw-webui/actions)
[![Coverage Status](https://codecov.io/gh/ActivityWatch/aw-webui/branch/master/graph/badge.svg)](https://codecov.io/gh/ActivityWatch/aw-webui)
[![Known Vulnerabilities](https://snyk.io/test/github/ActivityWatch/aw-webui/badge.svg)](https://snyk.io/test/github/ActivityWatch/aw-webui)

## Getting started

Getting started with setting up the development environment is pretty straight forward:

```bash
# Start an instance of aw-server running in testing mode (on port 5666, with a separate database),
# This is what the web UI will connect to by default when run in development mode.
aw-qt --testing
# or, to run without watchers:
aw-server --testing

# Install dependencies
npm install
# or, to get exact versions of dependencies:
npm ci

# start aw-webui in dev mode
npm run serve
```

Alternatively, you can run `make dev` to install dependencies and serve the application locally.

You might have to configure CORS for it to work, see the CORS section below.

You may also want to generate fake data so you have something to test with, see: https://github.com/ActivityWatch/aw-fakedata/

## Building

To build the production bundle, simply run the following:

```bash
# Install dependencies
npm ci

# Build for production
npm run build
```

### Using a pre-release with your main install

**Note:** Running a development version of aw-webui with an old aw-server can lead to issues due to version incompatibilities.

You can run a development version of aw-webui with your main version of ActivityWatch by building it (or fetching the latest build from CI) and replacing placing the contents of the `static` directory of your aw-server (or aw-server-rust) installation. For simplicity, back up the original directory for easier switching back.

The assets are stored in the following directories (relative to your installation directory), depending on if you use aw-server-python (default) or aw-server-rust:

 - aw-server-python: `activitywatch/aw-server/aw_server/static/`
 - aw-server-rust: `activitywatch/aw-server-rust/static/`

Either copy the assets manually, or run `make build` from the `aw-server` parent directory to rebuild and copy the assets for you.

Once you've put the files in the directories, you may have to do a hard refresh in your browser to invalidate any stale caches.

If you want to actively iterate on aw-webui with your local production data, you'll want to use a development build, automatically update it, and connect a aw-server running against production data. To do this, in one terminal window run:

```bash
AW_SERVER_URL="'http://localhost:5600'" npx vue-cli-service build --watch --dest=../aw_server/static
```

If you want to add `debugger` statements in your code and otherwise break linting rules, you'll need to add a `--skip-plugins=no-debugger` to that command. Then,  in another terminal (with your venv activated, assuming you are using python aw-server) run:

```shell
poetry install
aw-server
```

## Tests

Tests can be run with:

```bash
npm test
```

There are also E2E tests. You need to have an aw-server and the web UI running in development mode (with `npm run serve`, as instructed above). After you have that setup, you can run the tests with:

```bash
make test-e2e
```

## Development

### CORS

For development, you'll also have to add/change CORS configuration in the
aw-server configs by adding `cors_origins = http://localhost:27180` to your
configuration file `~/.config/activitywatch/aw-server/aw-server.ini` under the
`server-testing` section.

### Code structure

One of the first things that happen in the application is the execution of `src/main.js`. This loads things such as bootstrap-vue and a bunch of other stuff that's globally used (filters, resources).

The main.js file then loads the `src/App.vue` file, which is the root component of the application.
