import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  Text,
  Badge,
  Input,
  Button,
  tokens,
  Spinner,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import {
  Dismiss16Regular,
  Add16Regular,
  ArrowTrendingLines24Regular,
} from "@fluentui/react-icons";
import { signalRService } from "../../../../shared/services/signalRService";
import { useMarketStore } from "../../store/marketStore";
import { useAuthStore } from "../../../auth/store/authStore";
import { useWatchlistStore } from "../../store/watchlistStore";
import { SentimentWidget } from "../../../ai/components/SentimentWidget";

// ✨ Fluent UI native styling (Replaces Dashboard.module.scss)
const useStyles = makeStyles({
  dashboardContainer: {
    ...shorthands.padding("24px"),
    maxWidth: "1400px",
    ...shorthands.margin("0", "auto"),
  },
  header: {
    ...shorthands.margin("0", "0", "24px", "0"),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    ...shorthands.gap("24px"),
    alignItems: "start",
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
    },
  },
  tickerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    ...shorthands.gap("16px"),
  },
  tickerCard: {
    cursor: "pointer",
    transitionProperty: "transform, box-shadow",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease",
    ...shorthands.border("1px", "solid", "transparent"),
    ":hover": {
      transform: "translateY(-2px)",
      boxShadow: tokens.shadow16,
      ...shorthands.borderColor(tokens.colorBrandStroke1),
    },
  },
  tickerCardEmpty: {
    minHeight: "140px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    ...shorthands.gap("12px"),
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("24px"),
    position: "sticky",
    top: "24px",
  },
});

export const Dashboard = () => {
  const styles = useStyles();
  const navigate = useNavigate();

  const token = useAuthStore((state) => state.token);
  const tickers = useMarketStore((state) => state.tickers);
  const { symbols: watchList, addSymbol, removeSymbol } = useWatchlistStore();
  const [newSymbol, setNewSymbol] = useState("");

  useEffect(() => {
    const init = async () => {
      await signalRService.startConnection();
      watchList.forEach((symbol) => signalRService.joinGroup(symbol));
    };
    init();
  }, [token, watchList]);

  const handleAddSymbol = () => {
    if (newSymbol) {
      addSymbol(newSymbol.toUpperCase());
      setNewSymbol("");
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <Text size={800} weight="semibold" as="h1">
          Market Overview
        </Text>
      </header>

      <div className={styles.grid}>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Card
            style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Input
                value={newSymbol}
                onChange={(_, d) => setNewSymbol(d.value)}
                placeholder="Add symbol (e.g. ADAUSDT)"
                style={{ flex: 1 }}
                onKeyDown={(e) => e.key === "Enter" && handleAddSymbol()}
              />
              <Button
                icon={<Add16Regular />}
                appearance="primary"
                onClick={handleAddSymbol}
              >
                Add Coin
              </Button>
            </div>
          </Card>

          <div className={styles.tickerGrid}>
            {watchList.map((symbol) => {
              const ticker = tickers[symbol];

              if (!ticker) {
                return (
                  <Card key={symbol} className={styles.tickerCardEmpty}>
                    <CardHeader
                      action={
                        <Button
                          icon={<Dismiss16Regular />}
                          appearance="transparent"
                          onClick={() => removeSymbol(symbol)}
                        />
                      }
                    />
                    <Text size={400} weight="semibold">
                      {symbol}
                    </Text>
                    <Spinner size="tiny" label="Connecting..." />
                  </Card>
                );
              }

              const isUp = ticker.trend === "up";
              const isDown = ticker.trend === "down";

              return (
                <Card
                  key={symbol}
                  className={styles.tickerCard}
                  style={{
                    backgroundColor: tokens.colorNeutralBackground1Hover,
                  }}
                  onClick={() => navigate(`/market/${symbol}`)}
                >
                  <CardHeader
                    header={
                      <Text weight="semibold" size={500}>
                        {symbol}
                      </Text>
                    }
                    description={
                      <Text
                        size={200}
                        style={{ color: tokens.colorNeutralForeground3 }}
                      >
                        {new Date(ticker.timestamp).toLocaleTimeString()}
                      </Text>
                    }
                    action={
                      // ✨ FIXED: Added alignItems: "center" to perfectly align Badge and Button
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Badge
                          appearance="tint"
                          shape="rounded"
                          color={
                            isUp ? "success" : isDown ? "danger" : "informative"
                          }
                          style={{
                            minWidth: "85px",
                          }}
                        >
                          {isUp ? "▲" : isDown ? "▼" : "−"}{" "}{ticker.trend.toUpperCase()}
                        </Badge>
                        <Button
                          icon={<Dismiss16Regular />}
                          appearance="transparent"
                          onClick={() => removeSymbol(symbol)}
                        />
                      </div>
                    }
                  />

                  <div
                    style={{
                      marginTop: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                    }}
                  >
                    <Text
                      size={800}
                      weight="bold"
                      style={{
                        color: isUp
                          ? tokens.colorPaletteGreenForeground1
                          : isDown
                            ? tokens.colorPaletteRedForeground1
                            : tokens.colorNeutralForeground1,
                      }}
                    >
                      $
                      {ticker.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </Text>

                    <Button
                      icon={<ArrowTrendingLines24Regular />}
                      appearance="subtle"
                    >
                      Trade
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className={styles.sidebar}>
          <SentimentWidget />
        </div>
      </div>
    </div>
  );
};
