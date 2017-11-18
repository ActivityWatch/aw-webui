.PHONY: install build dev test clean

.FORCE: ;

build: install
	npm run build

install:
	npm install

uninstall:
	rm -r node_modules/

dev:
	npm run dev

test:
	babel-node test.js

clean:
	rm -rf node_modules dist
