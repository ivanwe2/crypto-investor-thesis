package grpc

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	pb "ingestor/gen/marketgateway/v1"
	"ingestor/internal/cache"
	"ingestor/internal/exchange"
	"ingestor/internal/telemetry"

	"google.golang.org/grpc"
)

type MarketDataServer struct {
	pb.UnimplementedMarketDataServiceServer
	cache   *cache.MarketCache
	metrics *telemetry.IngestorMetrics
}

func NewMarketDataServer(c *cache.MarketCache, m *telemetry.IngestorMetrics) *MarketDataServer {
	return &MarketDataServer{cache: c, metrics: m}
}

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

func (s *MarketDataServer) StreamMarketData(req *pb.StreamRequest, stream pb.MarketDataService_StreamMarketDataServer) error {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-stream.Context().Done():
			slog.Info("Client disconnected from gRPC stream")
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

func (s *MarketDataServer) GetHistoricalKlines(ctx context.Context, req *pb.KlinesRequest) (*pb.KlinesResponse, error) {
	klinesData, err := exchange.FetchHistoricalKlines(ctx, req.Symbol, req.Interval, req.Limit)
	if err != nil {
		slog.Error("Failed to fetch klines", "symbol", req.Symbol, "error", err)
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

func (s *MarketDataServer) GetOrderBookDepth(ctx context.Context, req *pb.OrderBookRequest) (*pb.OrderBookResponse, error) {
	depthData, err := exchange.FetchOrderBookDepth(ctx, req.Symbol, req.Limit)
	if err != nil {
		slog.Error("Failed to fetch order book depth", "symbol", req.Symbol, "error", err)
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

func (s *MarketDataServer) SubscribeSymbol(ctx context.Context, req *pb.SubscribeRequest) (*pb.SubscribeResponse, error) {
	isNew := exchange.SubManager.Subscribe(req.Symbol)

	if isNew {
		slog.Info("gRPC triggered new dynamic subscription", "symbol", req.Symbol)
		if s.metrics != nil {
			s.metrics.ActiveSubscriptions.Add(ctx, 1)
		}
		return &pb.SubscribeResponse{Success: true, Message: "Successfully opened live stream for " + req.Symbol}, nil
	}

	return &pb.SubscribeResponse{Success: true, Message: "Stream already active"}, nil
}

func (s *MarketDataServer) UnsubscribeSymbol(ctx context.Context, req *pb.UnsubscribeRequest) (*pb.UnsubscribeResponse, error) {
	removed := exchange.SubManager.Unsubscribe(req.Symbol)

	if removed {
		slog.Info("gRPC triggered dynamic unsubscription", "symbol", req.Symbol)
		if s.metrics != nil {
			s.metrics.ActiveSubscriptions.Add(ctx, -1)
		}
		return &pb.UnsubscribeResponse{Success: true, Message: "Stopped streaming " + req.Symbol}, nil
	}

	return &pb.UnsubscribeResponse{Success: true, Message: "Stream was not active"}, nil
}

func StartServer(port string, c *cache.MarketCache, m *telemetry.IngestorMetrics) *grpc.Server {
	lis, err := net.Listen("tcp", port)
	if err != nil {
		slog.Error("Failed to listen on gRPC port", "port", port, "error", err)
		panic(err)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterMarketDataServiceServer(grpcServer, NewMarketDataServer(c, m))

	go func() {
		slog.Info("gRPC MarketGateway listening", "port", port)
		if err := grpcServer.Serve(lis); err != nil {
			slog.Warn("gRPC Server stopped", "error", err)
		}
	}()

	return grpcServer
}
