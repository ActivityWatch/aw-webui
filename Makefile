.PHONY: install build dev test clean

.FORCE: ;

install:
	npm install

build: install
	npm run build

dev:
	npm run dev

test:
	babel-node test.js

clean:
	rm -rf node_modules dist
