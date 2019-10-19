.PHONY: install build dev test clean aw-client-js

.FORCE: ;

build: install
	npm run build

install: aw-client-js
	npm install

uninstall:
	rm -r node_modules/

dev:
	npm run serve

test:
	npm test

clean:
	rm -rf node_modules dist

lint:
	npx eslint --ext=js,vue src/

aw-client-js:
	make --directory=aw-client-js build
