package config

import (
	"os"
	"strings"
)

type Config struct {
	RabbitMQURL string
	HealthPort  string
	Symbols     []string
}

func Load() *Config {
	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		rabbitURL = "amqp://user:password@localhost:5672/"
	}

	symbols := []string{"btcusdt", "ethusdt", "solusdt"}
	if envSymbols := os.Getenv("INITIAL_SYMBOLS"); envSymbols != "" {
		symbols = strings.Split(strings.ToLower(envSymbols), ",")
	}

	return &Config{
		RabbitMQURL: rabbitURL,
		HealthPort:  ":8081",
		Symbols:     symbols,
	}
}
