package health

import (
	"net/http"
)

func NewServer(addr string) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"online","service":"ingestor"}`))
	})

	return &http.Server{
		Addr:    addr,
		Handler: mux,
	}
}
