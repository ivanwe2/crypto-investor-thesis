package config

import "os"

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

	return &Config{
		RabbitMQURL: rabbitURL,
		HealthPort:  ":8081",
		Symbols:     []string{"btcusdt", "ethusdt", "solusdt"},
	}
}
