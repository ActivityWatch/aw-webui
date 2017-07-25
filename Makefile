.PHONY: build dev clean

.FORCE: ;


build: .FORCE
	npm install
	npm run build

dev:
	npm install
	npm run dev

clean:
	rm -rf node_modules dist
