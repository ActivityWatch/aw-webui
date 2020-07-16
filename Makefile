.PHONY: install build dev test clean

.FORCE: ;

build: install
	npm run build

install:
	npm ci

uninstall:
	rm -r node_modules/

dev:
	npm run serve

test:
	npm test

test-e2e:
	testcafe firefox test/e2e/

clean:
	rm -rf node_modules dist

lint:
	npx eslint --ext=js,ts,vue --max-warnings=0 src/

lint-fix:
	npx eslint --ext=js,ts,vue --fix src/
