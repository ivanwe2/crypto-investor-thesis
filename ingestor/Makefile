# Variables to make it easy to change things later
APP_NAME = ingestor
MAIN_FILE = cmd/server/main.go

# 'all' is the default target if you just type 'make'
all: build

## 🔨 BUILD & RUN

# Compiles the code and puts the executable in a 'bin' folder
build:
	go build -o bin/$(APP_NAME) $(MAIN_FILE)

# A quick way to just run the code without saving a binary
run:
	go run $(MAIN_FILE)

## 🧪 TESTING & CLEANUP

# Runs all tests in the project
test:
	go test -v ./...

# Removes the compiled binary folder
clean:
	rm -rf bin/

## 📦 EXTRAS (Based on your folder structure)

# Generates the Go code from your proto file
proto:
	protoc --go_out=. --go-grpc_out=. proto/market_gateway.proto

# Builds the Docker container
docker:
	docker build -t $(APP_NAME):latest .