package health

import (
	"encoding/json"
	"net/http"
	"runtime"
)

type HealthResponse struct {
	Status        string `json:"status"`
	Service       string `json:"service"`
	Goroutines    int    `json:"goroutines"`
	MemoryAllocMb uint64 `json:"memoryAllocMb"`
	MemorySysMb   uint64 `json:"memorySysMb"`
}

func NewServer(addr string) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		response := HealthResponse{
			Status:     "online",
			Service:    "ingestor",
			Goroutines: runtime.NumGoroutine(),
			// Convert Bytes to Megabytes for easier reading on the frontend
			MemoryAllocMb: m.Alloc / 1024 / 1024,
			MemorySysMb:   m.Sys / 1024 / 1024,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	})

	return &http.Server{
		Addr:    addr,
		Handler: mux,
	}
}
