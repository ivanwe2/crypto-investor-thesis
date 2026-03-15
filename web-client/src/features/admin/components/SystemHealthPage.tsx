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
} from "@fluentui/react-icons";
// ✨ Fixed Import Path
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
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
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
    alignItems: "center",
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
      // Keep previous health state if possible, just show error
    }
  };

  useEffect(() => {
    fetchHealth();

    // Poll every 3 seconds for a live heartbeat
    let intervalId: any;
    if (isPolling) {
      intervalId = setInterval(fetchHealth, 3000);
    }

    return () => clearInterval(intervalId);
  }, [isPolling]);

  if (!health && !error) {
    return (
      <div className={styles.centerState}>
        <Spinner size="large" label="Pinging Microservices..." />
      </div>
    );
  }

  const isSystemHealthy = health?.status === "Healthy";

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.headerSection}>
        <div>
          <Text size={800} weight="bold" as="h1">
            System Observability
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
                  Gateway Latency: {health.responseTimeMs}ms
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
                health?.components.postgreSQL === "Up" ? "success" : "danger"
              }
            >
              {health?.components.postgreSQL || "Unknown"}
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
                health?.components.redisReadModel === "Up"
                  ? "success"
                  : "danger"
              }
            >
              {health?.components.redisReadModel || "Unknown"}
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

        {/* Go Market Gateway */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div
              className={styles.iconWrapper}
              style={{ backgroundColor: tokens.colorPaletteTealBackground2 }}
            >
              <ArrowSwap24Regular color={tokens.colorPaletteTealForeground2} />
            </div>
            <Badge
              appearance="filled"
              color={
                health?.components.goMarketGateway === "Connected"
                  ? "success"
                  : "danger"
              }
            >
              {health?.components.goMarketGateway || "Unknown"}
            </Badge>
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
        </Card>

        {/* AI Circuit Breaker (Polly) */}
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
                health?.components.aiCircuitBreaker === "Closed"
                  ? "success"
                  : health?.components.aiCircuitBreaker === "HalfOpen"
                    ? "warning"
                    : "danger"
              }
            >
              {health?.components.aiCircuitBreaker || "Unknown"}
            </Badge>
          </div>
          <div>
            <Text size={500} weight="semibold">
              AI Analyst Circuit
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {health?.components.aiCircuitBreaker === "Closed"
                ? "Circuit Closed (Traffic Flowing)"
                : health?.components.aiCircuitBreaker === "Open"
                  ? "Circuit Open (Traffic Blocked - Fail Fast)"
                  : "Circuit Half-Open (Testing Recovery)"}
            </Text>
          </div>
        </Card>

        {/* SignalR WebSockets */}
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
              {health?.components.activeSignalRConnections || 0}
            </Text>
          </div>
          <div>
            <Text size={500} weight="semibold">
              Active WebSockets
            </Text>
            <br />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Real-time SignalR Connections
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};
