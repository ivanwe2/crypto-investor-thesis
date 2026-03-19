import { useEffect, useState } from "react";
import {
  Card,
  Text,
  Spinner,
  Badge,
  tokens,
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
    ...shorthands.padding("24px"),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("24px"),
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
  },
  headerSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    ...shorthands.padding("0", "0", "16px", "0"),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke1),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    ...shorthands.gap("24px"),
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconWrapper: {
    width: "48px",
    height: "48px",
    ...shorthands.borderRadius("8px"),
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
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
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
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
          <Text size={800} weight="bold" as="h1">
            Enterprise Control Plane
          </Text>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "8px",
            }}
          >
            {error ? (
              <Badge color="danger" shape="rounded" icon={<Warning24Regular />}>
                API UNREACHABLE
              </Badge>
            ) : (
              <Badge
                color={isSystemHealthy ? "success" : "warning"}
                shape="rounded"
                icon={
                  isSystemHealthy ? (
                    <CheckmarkCircle24Regular />
                  ) : (
                    <Warning24Regular />
                  )
                }
              >
                SYSTEM {health?.status.toUpperCase()}
              </Badge>
            )}

            {health && (
              <>
                <Text
                  size={200}
                  style={{ color: tokens.colorNeutralForeground3 }}
                >
                  Uptime: {health.uptime}
                </Text>
                <Text
                  size={200}
                  style={{ color: tokens.colorNeutralForeground3 }}
                >
                  •
                </Text>
                <Text
                  size={200}
                  style={{ color: tokens.colorNeutralForeground3 }}
                >
                  BFF Latency: {health.responseTimeMs}ms
                </Text>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {lastUpdated && (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
          <Button
            appearance={isPolling ? "primary" : "secondary"}
            onClick={() => setIsPolling(!isPolling)}
          >
            {isPolling ? "Pause Live Sync" : "Resume Sync"}
          </Button>
          <Button icon={<ArrowClockwise16Regular />} onClick={fetchHealth} />
        </div>
      </div>

      <div className={styles.grid}>
        {/* PostgreSQL Database */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div
              className={styles.iconWrapper}
              style={{ backgroundColor: tokens.colorPaletteBlueBackground2 }}
            >
              <Database24Regular color={tokens.colorPaletteBlueForeground2} />
            </div>
            <Badge
              appearance="filled"
              color={
                health?.infrastructure.postgreSQL === "Up"
                  ? "success"
                  : "danger"
              }
            >
              {health?.infrastructure.postgreSQL || "Unknown"}
            </Badge>
          </div>
          <div>
            <Text size={500} weight="semibold">
              PostgreSQL (Write Model)
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Relational Database & Outbox Store
            </Text>
          </div>
        </Card>

        {/* Redis CQRS Cache */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div
              className={styles.iconWrapper}
              style={{ backgroundColor: tokens.colorPaletteRedBackground2 }}
            >
              <Storage24Regular color={tokens.colorPaletteRedForeground2} />
            </div>
            <Badge
              appearance="filled"
              color={
                health?.infrastructure.redis === "Up" ? "success" : "danger"
              }
            >
              {health?.infrastructure.redis || "Unknown"}
            </Badge>
          </div>
          <div>
            <Text size={500} weight="semibold">
              Redis (Read Model)
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              CQRS Fast-Path Projection Cache
            </Text>
          </div>
        </Card>

        {/* RabbitMQ Message Broker */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div
              className={styles.iconWrapper}
              style={{
                backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
              }}
            >
              <DataTrending24Regular
                color={tokens.colorPaletteDarkOrangeForeground2}
              />
            </div>
            <Badge
              appearance="filled"
              color={
                health?.infrastructure.rabbitMQ === "Online"
                  ? "success"
                  : "danger"
              }
            >
              {health?.infrastructure.rabbitMQ || "Unknown"}
            </Badge>
          </div>
          <div>
            <Text size={500} weight="semibold">
              RabbitMQ Broker
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Event-Driven Backbone
            </Text>
          </div>
          <div className={styles.metricsRow}>
            <Text size={300}>Trade Engine Queue Depth</Text>
            <Text
              weight="bold"
              style={{
                color:
                  health?.infrastructure.rabbitMqTradeEventsQueueDepth! > 1000
                    ? tokens.colorPaletteRedForeground1
                    : tokens.colorNeutralForeground1,
              }}
            >
              {health?.infrastructure.rabbitMqTradeEventsQueueDepth || 0} msgs
            </Text>
          </div>
          <div className={styles.metricsRow}>
            <Text size={300}>Delivery Throughput</Text>
            <Text
              weight="bold"
              style={{ color: tokens.colorPaletteGreenForeground1 }}
            >
              {health?.infrastructure.rabbitMqMessageRate || 0} msgs/sec
            </Text>
          </div>
        </Card>

        {/* Go Market Gateway Deep Metrics */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div
              className={styles.iconWrapper}
              style={{ backgroundColor: tokens.colorPaletteTealBackground2 }}
            >
              <ArrowSwap24Regular color={tokens.colorPaletteTealForeground2} />
            </div>
            {/* ✨ FIX: Render BOTH HTTP and gRPC Connection states explicitly! */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                alignItems: "flex-end",
              }}
            >
              <Badge
                appearance="filled"
                color={
                  health?.infrastructure.goMarketGateway === "Connected"
                    ? "success"
                    : "danger"
                }
              >
                gRPC: {health?.infrastructure.goMarketGateway || "Unknown"}
              </Badge>
              <Badge
                appearance="tint"
                color={
                  health?.goGatewayMetrics.status === "Online"
                    ? "success"
                    : "danger"
                }
              >
                HTTP: {health?.goGatewayMetrics.status || "Offline"}
              </Badge>
            </div>
          </div>
          <div>
            <Text size={500} weight="semibold">
              Go Market Gateway
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              HTTP/2 gRPC Streaming Link
            </Text>
          </div>
          <div className={styles.metricsRow}>
            <Text size={300}>Active Goroutines</Text>
            <Text weight="bold">
              {health?.goGatewayMetrics.goroutines || 0}
            </Text>
          </div>
          <div className={styles.metricsRow}>
            <Text size={300}>Heap Memory Allocated</Text>
            <Text weight="bold">
              {health?.goGatewayMetrics.memoryAllocMb || 0} MB
            </Text>
          </div>
        </Card>

        {/* .NET Trade Engine Deep Metrics */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div
              className={styles.iconWrapper}
              style={{ backgroundColor: tokens.colorPalettePurpleBackground2 }}
            >
              <Server24Regular color={tokens.colorPalettePurpleForeground2} />
            </div>
            <Badge appearance="filled" color="success">
              Engine Online
            </Badge>
          </div>
          <div>
            <Text size={500} weight="semibold">
              .NET Matching Engine
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              C# RAM Matcher & ThreadPool
            </Text>
          </div>
          <div className={styles.metricsRow}>
            <Text size={300}>Available Worker Threads</Text>
            <Text weight="bold">
              {health?.dotNetMetrics.availableWorkerThreads || 0}
            </Text>
          </div>
          <div className={styles.metricsRow}>
            <Text size={300}>GC Total Memory</Text>
            <Text weight="bold">
              {health?.dotNetMetrics.garbageCollectionAllocatedMb || 0} MB
            </Text>
          </div>
        </Card>

        {/* Real-Time WebSockets */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div
              className={styles.iconWrapper}
              style={{ backgroundColor: tokens.colorPaletteGreenBackground2 }}
            >
              <BroadActivityFeed24Regular
                color={tokens.colorPaletteGreenForeground2}
              />
            </div>
            <Text
              size={800}
              weight="bold"
              style={{ color: tokens.colorPaletteGreenForeground1 }}
            >
              {health?.dotNetMetrics.activeSignalRConnections || 0}
            </Text>
          </div>
          <div>
            <Text size={500} weight="semibold">
              Active WebSockets
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Global SignalR Hub Connections
            </Text>
          </div>
        </Card>

        {/* AI Analyst Circuit */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div
              className={styles.iconWrapper}
              style={{ backgroundColor: tokens.colorPalettePlumBackground2 }}
            >
              <Bot24Regular color={tokens.colorPalettePlumForeground2} />
            </div>
            <Badge
              appearance="filled"
              color={
                health?.infrastructure.aiAnalyst === "Online"
                  ? "success"
                  : "danger"
              }
            >
              {health?.infrastructure.aiAnalyst || "Offline"}
            </Badge>
          </div>
          <div>
            <Text size={500} weight="semibold">
              AI Sentiment Analyst
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              HuggingFace FinBERT via FastAPI
            </Text>
          </div>
          <div className={styles.metricsRow} style={{ borderBottom: "none" }}>
            <Text size={300}>Polly Circuit State</Text>
            <Badge
              appearance="outline"
              color={
                health?.infrastructure.aiCircuitBreaker === "Closed"
                  ? "success"
                  : health?.infrastructure.aiCircuitBreaker === "HalfOpen"
                    ? "warning"
                    : "danger"
              }
            >
              {health?.infrastructure.aiCircuitBreaker}
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  );
};
