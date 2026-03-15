PACKAGE_MANAGER = npm
APP_NAME = cryptothesis-frontend

.PHONY: all install dev build lint clean docker

all: install build

# Installs node modules
install:
	$(PACKAGE_MANAGER) install

# Starts the Vite development server with Hot Module Replacement
dev:
	$(PACKAGE_MANAGER) run dev

# Compiles TypeScript and builds the production bundle
build:
	$(PACKAGE_MANAGER) run build

# Runs ESLint to check for code quality issues
lint:
	$(PACKAGE_MANAGER) run lint

# Removes the node_modules and dist folders for a fresh start
clean:
	rm -rf node_modules
	rm -rf dist
	rm -f package-lock.json

# Builds the Docker container for the React frontend (usually uses Nginx)
docker:
	docker build -t $(APP_NAME):latest .