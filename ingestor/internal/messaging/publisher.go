package messaging

import (
	"context"
	"encoding/json"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

type RabbitMQClient struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

func NewRabbitMQClient(url string) (*RabbitMQClient, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}

	err = ch.ExchangeDeclare(
		"crypto_prices",
		"fanout",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, err
	}

	return &RabbitMQClient{conn: conn, channel: ch}, nil
}

// ✨ CHANGED: Added context.Context as the first argument so we can track the trace
func (c *RabbitMQClient) Publish(ctx context.Context, data interface{}) error {
	body, err := json.Marshal(data)
	if err != nil {
		return err
	}

	// 1. Start a span for the publish operation
	tr := otel.Tracer("rabbitmq")
	ctx, span := tr.Start(ctx, "Publish to crypto_prices")
	defer span.End()

	// 2. Extract the W3C Trace Context from Go
	headers := make(amqp.Table)
	carrier := propagation.MapCarrier{}
	otel.GetTextMapPropagator().Inject(ctx, carrier)

	// 3. Inject it into the RabbitMQ AMQP Headers
	for k, v := range carrier {
		headers[k] = v
	}

	pubCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	return c.channel.PublishWithContext(pubCtx,
		"crypto_prices",
		"",
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Headers:     headers, // ✨ The magic happens here!
			Body:        body,
		})
}

func (c *RabbitMQClient) Close() {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}
