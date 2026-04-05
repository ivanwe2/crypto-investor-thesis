APP_NAME = ingestor
MAIN_FILE = cmd/server/main.go

.PHONY: all build run test clean proto docker

# 'all' is the default target if you just type 'make'
all: build

# Compiles the code and puts the executable in a 'bin' folder
build:
	go build -o bin/$(APP_NAME) $(MAIN_FILE)

# A quick way to just run the code without saving a binary
run:
	go run $(MAIN_FILE)

# Runs all tests in the project
test:
	go test -v ./...

# Removes the compiled binary folder
clean:
	rm -rf bin/

# Generates the Go code from your proto file
proto:
	protoc --go_out=. --go_opt=module=ingestor --go-grpc_out=. --go-grpc_opt=module=ingestor proto/market_gateway.proto

# Builds the Docker container
docker:
	docker build -t $(APP_NAME):latest .