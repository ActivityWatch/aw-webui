.PHONY: build dev test clean

.FORCE: ;

# This is to disable check for new release in aw-webui for aw-android
# (vite.config.ts reads VUE_APP_ON_ANDROID to select the mobile defaults)
ifdef ON_ANDROID
export VUE_APP_ON_ANDROID := true
endif

prebuild: node_modules/ static/logo.png static/logo.svg

build: prebuild
	npm run build

dev: prebuild
	npm run serve

build-vite: prebuild
	npx vite build

dev-vite: prebuild
	npx vite

static/logo.%: media/logo/logo.%
	@mkdir -p static
	cp $< $@

node_modules/: package-lock.json
	npm ci

uninstall:
	rm -r node_modules/

test:
	npm test

test-e2e:
	npx testcafe --ts-config-path test/e2e/tsconfig.json chrome test/e2e/ -s takeOnFails=true

typing-coverage:
	npx typescript-coverage-report

clean:
	rm -rf node_modules dist

lint:
	npx eslint --ext=js,ts,vue --max-warnings=0 src/ test/

lint-fix:
	npx eslint --ext=js,ts,vue --fix src/ test/
