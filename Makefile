.PHONY: install build dev test clean aw-client-js

.FORCE: ;

aw-client-js:
	(cd aw-client-js; npm install; npm run compile)

build: install
	npm run build

install: aw-client-js
	npm install

uninstall:
	rm -r node_modules/

dev:
	npm run dev

test:
	babel-node test.js

lint:
	npx eslint src/ --ext .vue,.js

clean:
	rm -rf node_modules dist
