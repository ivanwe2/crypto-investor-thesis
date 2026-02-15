package exchange

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const baseURL = "wss://stream.binance.com:9443/stream?streams="

func Connect(symbols []string) {
	var streamParams []string
	for _, s := range symbols {
		streamParams = append(streamParams, fmt.Sprintf("%s@trade", strings.ToLower(s)))
	}
	url := baseURL + strings.Join(streamParams, "/")

	log.Printf("Connecting to Binance: %s", url)

	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Fatal("Error connecting to Binance:", err)
	}
	defer c.Close()

	log.Println("Connected! Listening for trades...")

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			time.Sleep(2 * time.Second)
			continue
		}

		var event CombinedStreamEvent
		if err := json.Unmarshal(message, &event); err != nil {
			log.Println("Parse error:", err)
			continue
		}

		trade := event.Data
		// 4. Print with dynamic symbol
		log.Printf("💰 %s: $%s (Time: %d)", trade.Symbol, trade.Price, trade.TradeTime)
	}
}
