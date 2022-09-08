.PHONY: install build dev test clean

.FORCE: ;

# This is to disable check for new release in aw-webui for aw-android
ifdef ON_ANDROID
# The following flag will pass --android as a command line argument to vue-cli-service
# https://docs.npmjs.com/cli/run-script
androidflag := -- --os=android
else
androidflag :=
endif

build: install
	npm run build ${androidflag}

install:
	npm ci

uninstall:
	rm -r node_modules/

dev:
	npm run serve ${androidflag}

test:
	npm test

test-e2e:
	npx testcafe firefox test/e2e/ -s takeOnFails=true

typing-coverage:
	npx typescript-coverage-report

clean:
	rm -rf node_modules dist

lint:
	npx eslint --ext=js,ts,vue --max-warnings=0 src/ test/

lint-fix:
	npx eslint --ext=js,ts,vue --fix src/ test/
