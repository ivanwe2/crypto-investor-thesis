using System.Diagnostics.Metrics;

namespace TradeEngine.Infrastructure.Telemetry;

public class TradingMetrics
{
    public static readonly string MeterName = "TradeEngine.Trading";

    private readonly Counter<long> _ordersPlaced;
    private readonly Counter<long> _ordersMatched;
    private readonly Histogram<double> _settlementDuration;
    private readonly Histogram<double> _matchingLoopDuration;
    private readonly Counter<long> _outboxMessagesPublished;
    private readonly Counter<long> _ordersRejected;
    private readonly Counter<long> _outboxDeadLetters;

    public TradingMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create(MeterName);
        _ordersPlaced = meter.CreateCounter<long>("trade_engine.orders_placed", description: "Orders placed by type and side");
        _ordersMatched = meter.CreateCounter<long>("trade_engine.orders_matched", description: "Orders matched by the engine");
        _settlementDuration = meter.CreateHistogram<double>("trade_engine.settlement_duration_ms", "ms", "Time to settle a matched order");
        _matchingLoopDuration = meter.CreateHistogram<double>("trade_engine.matching_loop_duration_ms", "ms", "Time per matching loop iteration");
        _outboxMessagesPublished = meter.CreateCounter<long>("trade_engine.outbox_messages_published", description: "Outbox messages published to RabbitMQ");
        _ordersRejected = meter.CreateCounter<long>("trade_engine.orders_rejected", description: "Orders rejected at placement by reason");
        _outboxDeadLetters = meter.CreateCounter<long>("trade_engine.outbox_dead_letters", description: "Outbox messages that exceeded max retries");
    }

    public void RecordOrderPlaced(string type, string side)
        => _ordersPlaced.Add(1,
            new KeyValuePair<string, object?>("order.type", type),
            new KeyValuePair<string, object?>("order.side", side));

    public void RecordOrderMatched() => _ordersMatched.Add(1);
    public void RecordSettlementDuration(double ms) => _settlementDuration.Record(ms);
    public void RecordMatchingLoopDuration(double ms) => _matchingLoopDuration.Record(ms);
    public void RecordOutboxPublished() => _outboxMessagesPublished.Add(1);

    public void RecordOrderRejected(string reason)
        => _ordersRejected.Add(1, new KeyValuePair<string, object?>("rejection_reason", reason));

    public void RecordOutboxDeadLetter() => _outboxDeadLetters.Add(1);
}
