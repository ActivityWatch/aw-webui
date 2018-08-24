.PHONY: install build dev test clean aw-client-js

.FORCE: ;

build: install
	(cd node_modules/vis; npm install; npm run build; true)
	npm run build

install: aw-client-js
	npm install

uninstall:
	rm -r node_modules/

dev:
	npm run dev

test:
	babel-node test.js

clean:
	rm -rf node_modules dist

lint:
	npx eslint src/

aw-client-js:
	(cd aw-client-js; make build)
