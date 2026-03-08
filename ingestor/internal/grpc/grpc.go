package grpc

import (
	"context"
	"fmt"
	"log"
	"net"
	"time"

	pb "ingestor/gen/marketgateway/v1" // Imports our newly generated code
	"ingestor/internal/cache"

	"google.golang.org/grpc"
)

// MarketDataServer implements the generated protobuf interface
type MarketDataServer struct {
	pb.UnimplementedMarketDataServiceServer
	cache *cache.MarketCache
}

func NewMarketDataServer(c *cache.MarketCache) *MarketDataServer {
	return &MarketDataServer{cache: c}
}

// 1. Unary Request: Get a single snapshot instantly
func (s *MarketDataServer) GetMarketSnapshot(ctx context.Context, req *pb.SnapshotRequest) (*pb.MarketSnapshot, error) {
	snap, exists := s.cache.GetSnapshot(req.Symbol)
	if !exists {
		return nil, fmt.Errorf("symbol %s not found in cache", req.Symbol)
	}
	return &pb.MarketSnapshot{
		Symbol:       snap.Symbol,
		Price:        snap.Price,
		Volatility:   snap.Volatility,
		TimestampUtc: snap.Timestamp,
	}, nil
}

// 2. Unary Request: Get volatility regime
func (s *MarketDataServer) GetVolatilityScore(ctx context.Context, req *pb.VolatilityRequest) (*pb.VolatilityResponse, error) {
	snap, exists := s.cache.GetSnapshot(req.Symbol)
	if !exists {
		return nil, fmt.Errorf("symbol %s not found", req.Symbol)
	}

	// Simple AI/Rules engine for volatility regimes
	regime := "NORMAL"
	if snap.Volatility > 5.0 {
		regime = "HIGH"
	} else if snap.Volatility < 1.0 {
		regime = "LOW"
	}

	return &pb.VolatilityResponse{
		Symbol:     snap.Symbol,
		Volatility: snap.Volatility,
		Regime:     regime,
	}, nil
}

// 3. Streaming Request: Push continuous updates to the client
func (s *MarketDataServer) StreamMarketData(req *pb.StreamRequest, stream pb.MarketDataService_StreamMarketDataServer) error {
	// Send updates twice a second. Much lighter than raw WebSocket ticks!
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-stream.Context().Done():
			// The client (e.g., .NET) disconnected
			log.Println("[INFO] Client disconnected from gRPC stream")
			return nil
		case <-ticker.C:
			// Loop through requested symbols and send latest cache snapshots
			for _, symbol := range req.Symbols {
				if snap, exists := s.cache.GetSnapshot(symbol); exists {
					err := stream.Send(&pb.MarketSnapshot{
						Symbol:       snap.Symbol,
						Price:        snap.Price,
						Volatility:   snap.Volatility,
						TimestampUtc: snap.Timestamp,
					})
					if err != nil {
						return err // Stream broken
					}
				}
			}
		}
	}
}

// StartServer spins up the gRPC listener on a background thread
func StartServer(port string, c *cache.MarketCache) {
	lis, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("[FATAL] Failed to listen on gRPC port: %v", err)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterMarketDataServiceServer(grpcServer, NewMarketDataServer(c))

	log.Printf("[INFO] gRPC MarketGateway listening on %s", port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("[FATAL] Failed to serve gRPC: %v", err)
	}
}
