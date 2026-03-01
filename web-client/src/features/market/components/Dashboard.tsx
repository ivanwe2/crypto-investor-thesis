import { useEffect } from "react";
import { 
  Card, 
  CardHeader, 
  Text, 
  Badge, 
  tokens 
} from "@fluentui/react-components";
import { signalRService } from "../../../shared/services/signalRService";
import { useMarketStore } from "../store/marketStore";
import { useAuthStore } from "../../auth/store/authStore";

import styles from "./Dashboard.module.scss";

import { SentimentWidget } from "../../../features/ai/components/SentimentWidget";
import { AuthWidget } from "../../../features/auth/components/AuthWidget";
import { TradePanel } from "../../../features/trading/components/TradePanel";
import { ToastContainer } from "../../../shared/components/toast/ToastContainer";

const WATCH_LIST = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

export const Dashboard = () => {
  const token = useAuthStore((state) => state.token);
  const tickers = useMarketStore((state) => state.tickers);

  useEffect(() => {
    const init = async () => {
      await signalRService.startConnection();
      WATCH_LIST.forEach((symbol) => signalRService.joinGroup(symbol));
    };
    init();
  }, [token]);

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <Text size={800} weight="semibold" as="h1">
          Trading Terminal
        </Text>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
          Distributed Crypto Trading System v0.4
        </Text>
      </header>

      <div className={styles.grid}>
        {/* Left Column: Price Cards */}
        <div className={styles.tickerGrid}>
          {WATCH_LIST.map((symbol) => {
            const ticker = tickers[symbol];

            if (!ticker) {
              return (
                <Card key={symbol} style={{ minHeight: '160px', justifyContent: 'center', alignItems: 'center' }}>
                  <Text size={400} weight="semibold">{symbol}</Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Connecting to stream...</Text>
                </Card>
              );
            }

            const isUp = ticker.trend === "up";
            const isDown = ticker.trend === "down";
            
            const badgeColor = isUp ? "success" : isDown ? "danger" : "informative";
            const trendArrow = isUp ? "▲" : isDown ? "▼" : "−";

            return (
              <Card key={symbol} style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}>
                <CardHeader
                  header={<Text weight="semibold" size={400}>{symbol}</Text>}
                  description={
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      {new Date(ticker.timestamp).toLocaleTimeString()}
                    </Text>
                  }
                  action={
                    <Badge appearance="tint" color={badgeColor}>
                      {trendArrow} {ticker.trend.toUpperCase()}
                    </Badge>
                  }
                />
                
                <Text 
                  size={800} 
                  weight="bold" 
                  style={{ 
                    color: isUp ? tokens.colorPaletteGreenForeground1 : isDown ? tokens.colorPaletteRedForeground1 : tokens.colorNeutralForeground1,
                    margin: '12px 0'
                  }}
                >
                  ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </Text>

                {/* The Trade Panel injection */}
                <TradePanel symbol={symbol} currentPrice={ticker.price} />
              </Card>
            );
          })}
        </div>

        {/* Right Column: Auth & AI Widgets */}
        <div className={styles.sidebar}>
          {/* Wrapping your old widgets in Fluent UI Cards to make them match! */}
          <Card>
            <AuthWidget />
          </Card>
          
          <Card>
            <SentimentWidget />
          </Card>
          
          <ToastContainer />
        </div>
      </div>
    </div>
  );
};