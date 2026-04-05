import { useEffect, useState } from "react";
import {
  Card,
  Text,
  Spinner,
  Badge,
  makeStyles,
  shorthands,
  Button,
} from "@fluentui/react-components";
import {
  Database24Regular,
  Storage24Regular,
  ArrowSwap24Regular,
  Bot24Regular,
  BroadActivityFeed24Regular,
  ArrowClockwise16Regular,
  Warning24Regular,
  CheckmarkCircle24Regular,
  DataTrending24Regular,
  Server24Regular,
} from "@fluentui/react-icons";
import {
  systemService,
  type SystemHealthResponse,
} from "../services/systemService";

const useStyles = makeStyles({
  pageWrapper: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("24px"),
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    animation: "ct-fade-in 0.35s ease-out both",
  },
  headerSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    ...shorthands.padding("0", "0", "16px", "0"),
    ...shorthands.borderBottom("1px", "solid", "var(--ct-border)"),
  },
  pageTitle: {
    fontFamily: "var(--ct-font-sans)",
    letterSpacing: "-0.03em",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
    marginTop: "8px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    ...shorthands.gap("16px"),
  },
  card: {
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    ...shorthands.padding("18px"),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("14px"),
    transitionProperty: "border-color",
    transitionDuration: "0.2s",
    ":hover": {
      ...shorthands.borderColor("var(--ct-border-hover)"),
    },
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconWrapper: {
    width: "42px",
    height: "42px",
    ...shorthands.borderRadius("10px"),
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
  },
  centerState: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "400px",
    ...shorthands.gap("16px"),
  },
  metricsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...shorthands.padding("8px", "0"),
    ...shorthands.borderBottom("1px", "solid", "var(--ct-border)"),
  },
  metricLabel: {
    fontFamily: "var(--ct-font-sans)",
    fontSize: "13px",
    color: "var(--ct-text-secondary)",
  },
  metricValue: {
    fontFamily: "var(--ct-font-mono)",
    fontWeight: "600",
    fontSize: "13px",
  },
  serviceName: {
    fontFamily: "var(--ct-font-sans)",
    letterSpacing: "-0.01em",
  },
  serviceDesc: {
    fontFamily: "var(--ct-font-mono)",
    fontSize: "11px",
    color: "var(--ct-text-muted)",
    letterSpacing: "0.02em",
  },
  controlsRow: {
    display: "flex",
    ...shorthands.gap("10px"),
    alignItems: "center",
  },
});

export const SystemHealthPage = () => {
  const styles = useStyles();
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const fetchHealth = async () => {
    try {
      const data = await systemService.getHealth();
      setHealth(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Health check failed", err);
      setError("Failed to reach API Gateway. The .NET service might be down.");
    }
  };

  useEffect(() => {
    fetchHealth();
    let intervalId: any;
    if (isPolling) {
      intervalId = setInterval(fetchHealth, 3000);
    }
    return () => clearInterval(intervalId);
  }, [isPolling]);

  if (!health && !error) {
    return (
      <div className={styles.centerState}>
        <Spinner size="large" label="Aggregating Polyglot Telemetry..." />
      </div>
    );
  }

  const isSystemHealthy = health?.status === "Healthy";

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.headerSection}>
        <div>
          <Text size={800} weight="bold" as="h1" className={styles.pageTitle}>
            System Health
          </Text>
          <div className={styles.statusRow}>
            {error ? (
              <Badge color="danger" shape="rounded" icon={<Warning24Regular />}
                style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
                API UNREACHABLE
              </Badge>
            ) : (
              <Badge
                color={isSystemHealthy ? "success" : "warning"}
                shape="rounded"
                icon={isSystemHealthy ? <CheckmarkCircle24Regular /> : <Warning24Regular />}
                style={{
                  fontFamily: "var(--ct-font-mono)",
                  fontSize: "11px",
                  boxShadow: isSystemHealthy ? "var(--ct-glow-bullish)" : "none",
                }}
              >
                {health?.status.toUpperCase()}
              </Badge>
            )}

            {health && (
              <>
                <Text size={200} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-mono)" }}>
                  Uptime: {health.uptime}
                </Text>
                <Text size={200} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-mono)" }}>
                  Latency: {health.responseTimeMs}ms
                </Text>
              </>
            )}
          </div>
        </div>

        <div className={styles.controlsRow}>
          {lastUpdated && (
            <Text size={200} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-mono)" }}>
              {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
          <Button
            appearance={isPolling ? "primary" : "secondary"}
            size="small"
            onClick={() => setIsPolling(!isPolling)}
            style={{ borderRadius: "var(--ct-radius-sm)" }}
          >
            {isPolling ? "Pause" : "Resume"}
          </Button>
          <Button icon={<ArrowClockwise16Regular />} size="small" onClick={fetchHealth} appearance="subtle" />
        </div>
      </div>

      <div className={styles.grid}>
        {/* PostgreSQL */}
        <Card className={styles.card} style={{ animation: "ct-fade-in 0.3s ease-out 0ms both" }}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper} style={{ backgroundColor: "rgba(59,130,246,0.1)" }}>
              <Database24Regular style={{ color: "#60A5FA" }} />
            </div>
            <Badge appearance="filled" color={health?.infrastructure.postgreSQL === "Up" ? "success" : "danger"}
              style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
              {health?.infrastructure.postgreSQL || "Unknown"}
            </Badge>
          </div>
          <div>
            <Text size={400} weight="semibold" className={styles.serviceName}>PostgreSQL</Text>
            <br />
            <Text className={styles.serviceDesc}>Write Model &bull; Event Store</Text>
          </div>
        </Card>

        {/* Redis */}
        <Card className={styles.card} style={{ animation: "ct-fade-in 0.3s ease-out 40ms both" }}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper} style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
              <Storage24Regular style={{ color: "#F87171" }} />
            </div>
            <Badge appearance="filled" color={health?.infrastructure.redis === "Up" ? "success" : "danger"}
              style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
              {health?.infrastructure.redis || "Unknown"}
            </Badge>
          </div>
          <div>
            <Text size={400} weight="semibold" className={styles.serviceName}>Redis</Text>
            <br />
            <Text className={styles.serviceDesc}>CQRS Read Model &bull; Cache</Text>
          </div>
        </Card>

        {/* RabbitMQ */}
        <Card className={styles.card} style={{ animation: "ct-fade-in 0.3s ease-out 80ms both" }}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper} style={{ backgroundColor: "rgba(251,191,36,0.1)" }}>
              <DataTrending24Regular style={{ color: "#FBBF24" }} />
            </div>
            <Badge appearance="filled" color={health?.infrastructure.rabbitMQ === "Online" ? "success" : "danger"}
              style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
              {health?.infrastructure.rabbitMQ || "Unknown"}
            </Badge>
          </div>
          <div>
            <Text size={400} weight="semibold" className={styles.serviceName}>RabbitMQ</Text>
            <br />
            <Text className={styles.serviceDesc}>Message Broker &bull; Event Bus</Text>
          </div>
          <div className={styles.metricsRow}>
            <Text className={styles.metricLabel}>Queue Depth</Text>
            <Text className={styles.metricValue} style={{
              color: health?.infrastructure.rabbitMqTradeEventsQueueDepth! > 1000
                ? "var(--ct-bearish)" : "var(--ct-text-primary)",
            }}>
              {health?.infrastructure.rabbitMqTradeEventsQueueDepth || 0} msgs
            </Text>
          </div>
          <div className={styles.metricsRow} style={{ borderBottom: "none" }}>
            <Text className={styles.metricLabel}>Throughput</Text>
            <Text className={styles.metricValue} style={{ color: "var(--ct-bullish)" }}>
              {health?.infrastructure.rabbitMqMessageRate || 0} msg/s
            </Text>
          </div>
        </Card>

        {/* Go Market Gateway */}
        <Card className={styles.card} style={{ animation: "ct-fade-in 0.3s ease-out 120ms both" }}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper} style={{ backgroundColor: "rgba(16,185,129,0.1)" }}>
              <ArrowSwap24Regular style={{ color: "#34D399" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
              <Badge appearance="filled" color={health?.infrastructure.goMarketGateway === "Connected" ? "success" : "danger"}
                style={{ fontFamily: "var(--ct-font-mono)", fontSize: "10px" }}>
                gRPC: {health?.infrastructure.goMarketGateway || "Unknown"}
              </Badge>
              <Badge appearance="tint" color={health?.goGatewayMetrics.status === "Online" ? "success" : "danger"}
                style={{ fontFamily: "var(--ct-font-mono)", fontSize: "10px" }}>
                HTTP: {health?.goGatewayMetrics.status || "Offline"}
              </Badge>
            </div>
          </div>
          <div>
            <Text size={400} weight="semibold" className={styles.serviceName}>Go Gateway</Text>
            <br />
            <Text className={styles.serviceDesc}>gRPC Stream &bull; Market Data</Text>
          </div>
          <div className={styles.metricsRow}>
            <Text className={styles.metricLabel}>Goroutines</Text>
            <Text className={styles.metricValue}>{health?.goGatewayMetrics.goroutines || 0}</Text>
          </div>
          <div className={styles.metricsRow} style={{ borderBottom: "none" }}>
            <Text className={styles.metricLabel}>Heap Memory</Text>
            <Text className={styles.metricValue}>{health?.goGatewayMetrics.memoryAllocMb || 0} MB</Text>
          </div>
        </Card>

        {/* .NET Matching Engine */}
        <Card className={styles.card} style={{ animation: "ct-fade-in 0.3s ease-out 160ms both" }}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper} style={{ backgroundColor: "rgba(168,85,247,0.1)" }}>
              <Server24Regular style={{ color: "#C084FC" }} />
            </div>
            <Badge appearance="filled" color="success"
              style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
              Online
            </Badge>
          </div>
          <div>
            <Text size={400} weight="semibold" className={styles.serviceName}>.NET Engine</Text>
            <br />
            <Text className={styles.serviceDesc}>Matching &bull; Settlement</Text>
          </div>
          <div className={styles.metricsRow}>
            <Text className={styles.metricLabel}>Worker Threads</Text>
            <Text className={styles.metricValue}>{health?.dotNetMetrics.availableWorkerThreads || 0}</Text>
          </div>
          <div className={styles.metricsRow} style={{ borderBottom: "none" }}>
            <Text className={styles.metricLabel}>GC Memory</Text>
            <Text className={styles.metricValue}>{health?.dotNetMetrics.garbageCollectionAllocatedMb || 0} MB</Text>
          </div>
        </Card>

        {/* Active WebSockets */}
        <Card className={styles.card} style={{ animation: "ct-fade-in 0.3s ease-out 200ms both" }}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper} style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
              <BroadActivityFeed24Regular style={{ color: "#4ADE80" }} />
            </div>
            <Text
              size={800}
              weight="bold"
              style={{ color: "var(--ct-bullish)", fontFamily: "var(--ct-font-mono)", letterSpacing: "-0.03em" }}
            >
              {health?.dotNetMetrics.activeSignalRConnections || 0}
            </Text>
          </div>
          <div>
            <Text size={400} weight="semibold" className={styles.serviceName}>WebSockets</Text>
            <br />
            <Text className={styles.serviceDesc}>SignalR Hub &bull; Real-time</Text>
          </div>
        </Card>

        {/* AI Analyst */}
        <Card className={styles.card} style={{ animation: "ct-fade-in 0.3s ease-out 240ms both" }}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper} style={{ backgroundColor: "rgba(168,85,247,0.08)" }}>
              <Bot24Regular style={{ color: "#A855F7" }} />
            </div>
            <Badge appearance="filled" color={health?.infrastructure.aiAnalyst === "Online" ? "success" : "danger"}
              style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
              {health?.infrastructure.aiAnalyst || "Offline"}
            </Badge>
          </div>
          <div>
            <Text size={400} weight="semibold" className={styles.serviceName}>AI Analyst</Text>
            <br />
            <Text className={styles.serviceDesc}>FinBERT &bull; Sentiment</Text>
          </div>
          <div className={styles.metricsRow} style={{ borderBottom: "none" }}>
            <Text className={styles.metricLabel}>Circuit Breaker</Text>
            <Badge
              appearance="outline"
              color={
                health?.infrastructure.aiCircuitBreaker === "Closed" ? "success"
                  : health?.infrastructure.aiCircuitBreaker === "HalfOpen" ? "warning"
                    : "danger"
              }
              style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}
            >
              {health?.infrastructure.aiCircuitBreaker}
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  );
};
