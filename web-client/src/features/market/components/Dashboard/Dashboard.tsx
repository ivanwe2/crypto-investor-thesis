import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Text,
  Badge,
  Input,
  Button,
  Spinner,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import {
  Dismiss16Regular,
  Add16Regular,
  ArrowTrendingLines24Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import { signalRService } from "../../../../shared/services/signalRService";
import { useMarketStore } from "../../store/marketStore";
import { useAuthStore } from "../../../auth/store/authStore";
import { useWatchlistStore } from "../../store/watchlistStore";
import { marketService } from "../../services/marketService";
import { SentimentWidget } from "../../../ai/components/SentimentWidget";
import { AiSignalsFeed } from "../../../ai/components/AiSignalsFeed";
import { PopularMarkets } from "./PopularMarkets";
import { formatPrice } from "../../../../shared/utils/formatPrice";

const useStyles = makeStyles({
  dashboardContainer: {
    maxWidth: "1400px",
    ...shorthands.margin("0", "auto"),
  },
  header: {
    ...shorthands.margin("0", "0", "28px", "0"),
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: {
    fontFamily: "var(--ct-font-sans)",
    letterSpacing: "-0.03em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    ...shorthands.gap("24px"),
    alignItems: "start",
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
    },
  },
  searchCard: {
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    ...shorthands.padding("16px"),
  },
  searchRow: {
    display: "flex",
    ...shorthands.gap("8px"),
    alignItems: "center",
  },
  tickerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    ...shorthands.gap("12px"),
    marginTop: "20px",
  },
  tickerCard: {
    cursor: "pointer",
    transitionProperty: "transform, box-shadow, border-color",
    transitionDuration: "0.2s",
    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    ...shorthands.padding("16px"),
    ":hover": {
      transform: "translateY(-2px)",
      boxShadow: "var(--ct-shadow-elevated)",
      ...shorthands.borderColor("var(--ct-border-brand)"),
    },
  },
  tickerCardEmpty: {
    minHeight: "140px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    ...shorthands.gap("12px"),
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
  },
  tickerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tickerSymbol: {
    fontFamily: "var(--ct-font-sans)",
    fontWeight: "700",
    letterSpacing: "-0.01em",
  },
  tickerPrice: {
    fontFamily: "var(--ct-font-mono)",
    fontFeatureSettings: '"tnum" 1',
    marginTop: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("20px"),
    position: "sticky",
    top: "0px",
  },
  trendBadge: {
    fontFamily: "var(--ct-font-mono)",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.04em",
  },
});

export const Dashboard = () => {
  const styles = useStyles();
  const navigate = useNavigate();

  const token = useAuthStore((state) => state.token);
  const tickers = useMarketStore((state) => state.tickers);
  const { symbols: watchList, addSymbol, removeSymbol } = useWatchlistStore();
  const [newSymbol, setNewSymbol] = useState("");

  const joinedSymbols = useRef<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      await signalRService.startConnection();

      for (const symbol of watchList) {
        if (joinedSymbols.current.has(symbol)) continue;
        await signalRService.joinGroup(symbol);
        try {
          await marketService.trackMarket(symbol);
        } catch (err) {
          console.warn(`[Network] Failed to sync ${symbol} with Go Gateway`, err);
        }
        joinedSymbols.current.add(symbol);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const syncNewSymbols = async () => {
      const newSymbols = watchList.filter((s) => !joinedSymbols.current.has(s));
      if (newSymbols.length === 0) return;

      for (const symbol of newSymbols) {
        await signalRService.joinGroup(symbol);
        try {
          await marketService.trackMarket(symbol);
        } catch (err) {
          console.warn(`[Network] Failed to sync ${symbol} with Go Gateway`, err);
        }
        joinedSymbols.current.add(symbol);
      }
    };

    syncNewSymbols();
  }, [watchList]);

  const handleAddSymbol = async () => {
    if (!newSymbol) return;
    const symbolToTrack = newSymbol.toUpperCase().trim();
    setNewSymbol("");

    try {
      await marketService.trackMarket(symbolToTrack);
    } catch (err) {
      console.error(`Failed to track market ${symbolToTrack}`, err);
    }

    addSymbol(symbolToTrack);
  };

  const handleRemoveSymbol = async (symbol: string) => {
    removeSymbol(symbol);
    joinedSymbols.current.delete(symbol);
    await signalRService.leaveGroup(symbol);
  };

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <Text size={900} weight="bold" as="h1" className={styles.headerTitle}>
            Market Overview
          </Text>
          <Text
            size={300}
            style={{ color: "var(--ct-text-muted)", marginTop: 4, display: "block" }}
          >
            Track real-time prices across your watchlist
          </Text>
        </div>
      </header>

      <div className={styles.grid}>
        <div>
          {/* Search + Popular Markets */}
          <Card className={styles.searchCard}>
            <div className={styles.searchRow}>
              <Search20Regular style={{ color: "var(--ct-text-muted)", flexShrink: 0 }} />
              <Input
                value={newSymbol}
                onChange={(_, d) => setNewSymbol(d.value)}
                placeholder="Add any symbol (e.g. ADAUSDT)"
                style={{ flex: 1 }}
                onKeyDown={(e) => e.key === "Enter" && handleAddSymbol()}
                appearance="underline"
              />
              <Button
                icon={<Add16Regular />}
                appearance="primary"
                onClick={handleAddSymbol}
                size="small"
                style={{ borderRadius: "var(--ct-radius-sm)" }}
              >
                Add
              </Button>
            </div>
            <PopularMarkets />
          </Card>

          {/* Ticker Cards */}
          <div className={styles.tickerGrid}>
            {watchList.map((symbol, idx) => {
              const ticker = tickers[symbol];

              if (!ticker) {
                return (
                  <Card key={symbol} className={styles.tickerCardEmpty} style={{ animationDelay: `${idx * 50}ms` }}>
                    <Text size={400} weight="semibold" style={{ color: "var(--ct-text-secondary)" }}>
                      {symbol}
                    </Text>
                    <Spinner size="tiny" label="Connecting..." />
                    <Button
                      icon={<Dismiss16Regular />}
                      appearance="transparent"
                      size="small"
                      onClick={() => handleRemoveSymbol(symbol)}
                    />
                  </Card>
                );
              }

              const isUp = ticker.trend === "up";
              const isDown = ticker.trend === "down";

              return (
                <div
                  key={symbol}
                  className={styles.tickerCard}
                  onClick={() => navigate(`/market/${symbol}`)}
                  style={{
                    animation: `ct-fade-in 0.3s ease-out ${idx * 40}ms both`,
                  }}
                >
                  <div className={styles.tickerHeader}>
                    <div>
                      <Text weight="bold" size={500} className={styles.tickerSymbol}>
                        {symbol.replace("USDT", "")}
                      </Text>
                      <Text
                        size={100}
                        style={{
                          color: "var(--ct-text-muted)",
                          display: "block",
                          fontFamily: "var(--ct-font-mono)",
                          marginTop: 2,
                        }}
                      >
                        {symbol} / USDT
                      </Text>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                      <Badge
                        appearance="filled"
                        shape="rounded"
                        className={styles.trendBadge}
                        color={isUp ? "success" : isDown ? "danger" : "informative"}
                        style={{
                          boxShadow: isUp
                            ? "var(--ct-glow-bullish)"
                            : isDown
                              ? "var(--ct-glow-bearish)"
                              : "none",
                        }}
                      >
                        {isUp ? "+" : isDown ? "-" : "~"} {ticker.trend.toUpperCase()}
                      </Badge>
                      <Button
                        icon={<Dismiss16Regular />}
                        appearance="transparent"
                        size="small"
                        onClick={() => handleRemoveSymbol(symbol)}
                      />
                    </div>
                  </div>

                  <div className={styles.tickerPrice}>
                    <Text
                      size={ticker.price < 0.01 ? 500 : 800}
                      weight="bold"
                      style={{
                        color: isUp
                          ? "var(--ct-bullish)"
                          : isDown
                            ? "var(--ct-bearish)"
                            : "var(--ct-text-primary)",
                        fontFamily: "var(--ct-font-mono)",
                        letterSpacing: ticker.price < 0.01 ? "-0.02em" : "-0.03em",
                      }}
                    >
                      ${formatPrice(ticker.price)}
                    </Text>

                    <Button
                      icon={<ArrowTrendingLines24Regular />}
                      appearance="subtle"
                      size="small"
                      style={{ color: "var(--ct-brand)" }}
                    >
                      Trade
                    </Button>
                  </div>

                  <Text
                    size={100}
                    style={{
                      color: "var(--ct-text-muted)",
                      fontFamily: "var(--ct-font-mono)",
                      marginTop: 8,
                      display: "block",
                    }}
                  >
                    {new Date(ticker.timestamp).toLocaleTimeString()}
                  </Text>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <SentimentWidget />
          <AiSignalsFeed />
        </div>
      </div>
    </div>
  );
};
