.FORCE: ;


build: .FORCE
	npm install
	npm run build

dev:
	npm install
	npm run dev

test:
	npm install babel-cli babel-preset-es2015 jsdom@10.1
	babel-node test.js
