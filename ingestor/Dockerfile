# Build Stage
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .

# 1. Output the binary with a safe, unique name ("ingestor-bin")
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ingestor-bin cmd/server/main.go

# Run Stage
FROM alpine:latest
WORKDIR /root/

# 2. Copy the specific binary file and rename it to "ingestor" in the final image
COPY --from=builder /app/ingestor-bin ./ingestor

# Install certificates
RUN apk --no-cache add ca-certificates

# 3. Execute the binary
CMD ["./ingestor"]