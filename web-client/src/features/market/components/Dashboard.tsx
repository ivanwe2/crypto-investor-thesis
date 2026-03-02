import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  Text,
  Badge,
  Input,
  Button,
  tokens,
} from "@fluentui/react-components";
import { Dismiss16Regular, Add16Regular } from "@fluentui/react-icons";
import { signalRService } from "../../../shared/services/signalRService";
import { useMarketStore } from "../store/marketStore";
import { useAuthStore } from "../../auth/store/authStore";
import { useWatchlistStore } from "../store/watchlistStore";

import styles from "./Dashboard.module.scss";
import { AuthWidget } from "../../auth/components/AuthWidget";
import { SentimentWidget } from "../../ai/components/SentimentWidget";
import { TradePanel } from "../../trading/components/TradePanel";
import { ToastContainer } from "../../../shared/components/toast/ToastContainer";

export const Dashboard = () => {
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

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <Text size={800} weight="semibold" as="h1">
          Market Overview
        </Text>
      </header>

      <div className={styles.grid}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ✨ ADD SYMBOL WIDGET ✨ */}
          <Card
            style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Input
                value={newSymbol}
                onChange={(_, d) => setNewSymbol(d.value)}
                placeholder="Add symbol (e.g. ADAUSDT)"
                style={{ flex: 1 }}
              />
              <Button
                icon={<Add16Regular />}
                appearance="primary"
                onClick={() => {
                  addSymbol(newSymbol);
                  setNewSymbol("");
                }}
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
                  <Card
                    key={symbol}
                    style={{
                      minHeight: "160px",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
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
                    <Text
                      size={200}
                      style={{ color: tokens.colorNeutralForeground3 }}
                    >
                      Waiting for data...
                    </Text>
                  </Card>
                );
              }

              const isUp = ticker.trend === "up";
              const isDown = ticker.trend === "down";

              return (
                <Card
                  key={symbol}
                  style={{
                    backgroundColor: tokens.colorNeutralBackground1Hover,
                  }}
                >
                  <CardHeader
                    header={
                      <Text weight="semibold" size={400}>
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
                      <div style={{ display: "flex", gap: "4px" }}>
                        <Badge
                          appearance="tint"
                          size="medium"
                          shape="rounded"
                          color={
                            isUp ? "success" : isDown ? "danger" : "informative"
                          }
                        >
                          {isUp ? "▲" : isDown ? "▼" : "−"}{" "}
                          {ticker.trend.toUpperCase()}
                        </Badge>
                        <Button
                          icon={<Dismiss16Regular />}
                          appearance="transparent"
                          onClick={() => removeSymbol(symbol)}
                        />
                      </div>
                    }
                  />
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
                  <TradePanel symbol={symbol} currentPrice={ticker.price} />
                </Card>
              );
            })}
          </div>
        </div>

        <div className={styles.sidebar}>
          <AuthWidget />
          <SentimentWidget />
          <ToastContainer />
        </div>
      </div>
    </div>
  );
};
