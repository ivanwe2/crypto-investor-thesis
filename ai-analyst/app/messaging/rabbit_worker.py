import json
import logging
import os
import pika
import time
from opentelemetry import trace, metrics
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from app.services.analyzer import analyzer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("AI_Rabbit_Worker")

tracer = trace.get_tracer(__name__)
meter = metrics.get_meter(__name__)
analyses_counter = meter.create_counter("ai_analyst.analyses_performed", description="Total analyses performed")
signal_counter = meter.create_counter("ai_analyst.signal_distribution", description="Distribution of AI signals by type")
inference_histogram = meter.create_histogram("ai_analyst.inference_duration_ms", unit="ms", description="FinBERT inference duration")

class AIRabbitWorker:
    def __init__(self, amqp_url: str):
        self.amqp_url = amqp_url
        self.connection = None
        self.channel = None

    def connect(self):
        while True:
            try:
                parameters = pika.URLParameters(self.amqp_url)
                self.connection = pika.BlockingConnection(parameters)
                self.channel = self.connection.channel()
                
                self.channel.exchange_declare(exchange='trade_events', exchange_type='fanout', durable=True)
                self.channel.exchange_declare(exchange='ai_signals', exchange_type='fanout', durable=True)
                
                queue_result = self.channel.queue_declare(queue='ai_analyst_queue', durable=True)
                queue_name = queue_result.method.queue
                self.channel.queue_bind(exchange='trade_events', queue=queue_name)
                
                logger.info("✅ Connected to RabbitMQ. Listening for Trade events...")
                break
            except pika.exceptions.AMQPConnectionError:
                logger.warning("RabbitMQ not ready. Retrying in 5 seconds...")
                time.sleep(5)

    def analyze_trade(self, trade_data: dict) -> dict:
        symbol = trade_data.get("Symbol", "UNKNOWN")
        side = trade_data.get("Side", "").upper()
        quantity = float(trade_data.get("Quantity", 0))
        price = float(trade_data.get("Price", 0))
        total_value = quantity * price

        # ✨ Create a financial ticker "tape" statement for FinBERT
        if total_value > 50000:
            if side == "BUY":
                headline = f"Strong bullish momentum: Heavy accumulation and large block buy of {symbol} executed at premium."
            else:
                headline = f"Severe sell-off warning: Massive liquidation block of {symbol} dumped on the market."
        else:
            headline = f"Standard market execution: {side} order for {symbol} cleared at ${price:,.2f}."

        try:
            start = time.perf_counter()
            ai_response = analyzer.predict(headline)
            duration_ms = (time.perf_counter() - start) * 1000

            inference_histogram.record(duration_ms, {"symbol": symbol})
            analyses_counter.add(1, {"symbol": symbol})
            signal_counter.add(1, {"signal": ai_response.label})

            return {
                "Symbol": symbol,
                "Signal": ai_response.label,
                "Confidence": ai_response.score,
                "Reason": headline,
                "Timestamp": trade_data.get("Timestamp")
            }
        except Exception as e:
            logger.error(f"AI Prediction failed: {e}")
            return {
                "Symbol": symbol,
                "Signal": "NEUTRAL",
                "Confidence": 0.0,
                "Reason": "AI Analysis Failed",
                "Timestamp": trade_data.get("Timestamp")
            }

    def process_message(self, ch, method, properties, body):
        carrier = {}
        if properties.headers:
            for k, v in properties.headers.items():
                carrier[k] = v.decode('utf-8') if isinstance(v, bytes) else v

        ctx = TraceContextTextMapPropagator().extract(carrier=carrier)

        with tracer.start_as_current_span("Analyze Trade Event", context=ctx) as span:
            try:
                trade_data = json.loads(body)
                span.set_attribute("trade.symbol", trade_data.get("Symbol", ""))
                
                ai_result = self.analyze_trade(trade_data)
                
                span.set_attribute("ai.signal", ai_result["Signal"])
                span.set_attribute("ai.confidence", ai_result["Confidence"])

                self.publish_signal(ai_result, ctx)
                ch.basic_ack(delivery_tag=method.delivery_tag)

            except Exception as e:
                logger.error(f"Error processing message: {e}")
                span.record_exception(e)
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def publish_signal(self, signal_data: dict, ctx):
        out_carrier = {}
        TraceContextTextMapPropagator().inject(carrier=out_carrier, context=ctx)

        properties = pika.BasicProperties(
            content_type='application/json',
            headers=out_carrier
        )

        self.channel.basic_publish(
            exchange='ai_signals',
            routing_key='',
            body=json.dumps(signal_data),
            properties=properties
        )
        logger.info(f"📡 Published AI Signal: {signal_data['Signal']} (Conf: {signal_data['Confidence']:.2f})")

    def start(self):
        self.connect()
        self.channel.basic_qos(prefetch_count=1)
        self.channel.basic_consume(queue='ai_analyst_queue', on_message_callback=self.process_message)
        
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            self.channel.stop_consuming()
            if self.connection:
                self.connection.close()