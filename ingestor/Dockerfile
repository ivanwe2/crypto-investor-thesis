# Build Stage
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Build the binary named "ingestor"
RUN go build -o ingestor cmd/server/main.go

# Run Stage
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/ingestor .
# Install certificates so we can talk to Binance (HTTPS)
RUN apk --no-cache add ca-certificates
CMD ["./ingestor"]