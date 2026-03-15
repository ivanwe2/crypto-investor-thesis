package grpc

import (
	"context"
	"fmt"
	"log"
	"net"
	"time"

	pb "ingestor/gen/marketgateway/v1"
	"ingestor/internal/cache"
	"ingestor/internal/exchange"

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
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-stream.Context().Done():
			log.Println("[INFO] Client disconnected from gRPC stream")
			return nil
		case <-ticker.C:
			for _, symbol := range req.Symbols {
				if snap, exists := s.cache.GetSnapshot(symbol); exists {
					err := stream.Send(&pb.MarketSnapshot{
						Symbol:       snap.Symbol,
						Price:        snap.Price,
						Volatility:   snap.Volatility,
						TimestampUtc: snap.Timestamp,
					})
					if err != nil {
						return err
					}
				}
			}
		}
	}
}

// 4. ✨ NEW: Fetch Historical Klines via REST fallback
func (s *MarketDataServer) GetHistoricalKlines(ctx context.Context, req *pb.KlinesRequest) (*pb.KlinesResponse, error) {
	klinesData, err := exchange.FetchHistoricalKlines(ctx, req.Symbol, req.Interval, req.Limit)
	if err != nil {
		log.Printf("[ERROR] Failed to fetch klines: %v", err)
		return nil, err
	}

	response := &pb.KlinesResponse{
		Symbol: req.Symbol,
		Klines: make([]*pb.Kline, 0, len(klinesData)),
	}

	for _, k := range klinesData {
		response.Klines = append(response.Klines, &pb.Kline{
			StartTimeUtc: k.StartTimeUTC,
			Open:         k.Open,
			High:         k.High,
			Low:          k.Low,
			Close:        k.Close,
			Volume:       k.Volume,
		})
	}

	return response, nil
}

// 5. ✨ NEW: Fetch Order Book Depth via REST fallback
func (s *MarketDataServer) GetOrderBookDepth(ctx context.Context, req *pb.OrderBookRequest) (*pb.OrderBookResponse, error) {
	depthData, err := exchange.FetchOrderBookDepth(ctx, req.Symbol, req.Limit)
	if err != nil {
		log.Printf("[ERROR] Failed to fetch depth: %v", err)
		return nil, err
	}

	response := &pb.OrderBookResponse{
		Symbol:       req.Symbol,
		LastUpdateId: depthData.LastUpdateID,
		Bids:         make([]*pb.OrderBookEntry, 0, len(depthData.Bids)),
		Asks:         make([]*pb.OrderBookEntry, 0, len(depthData.Asks)),
	}

	for _, b := range depthData.Bids {
		response.Bids = append(response.Bids, &pb.OrderBookEntry{Price: b.Price, Size: b.Size})
	}
	for _, a := range depthData.Asks {
		response.Asks = append(response.Asks, &pb.OrderBookEntry{Price: a.Price, Size: a.Size})
	}

	return response, nil
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
