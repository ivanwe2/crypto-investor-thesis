import { ArrowTrendingLines24Regular } from "@fluentui/react-icons";
import { useMarketStore } from "../../store/marketStore";
import { useParams } from "react-router-dom";
import { Badge, Spinner, tokens, Text } from "@fluentui/react-components";
import { OrderBook } from "./OrderBook";
import { LivePriceChart } from "./LivePriceChart";
import { OrderForm } from "./OrderForm";

export const MarketDetailPage = () => {
  const { symbol = "BTCUSDT" } = useParams<{ symbol: string }>();
  
  const tickers = useMarketStore((state) => state.tickers);
  const ticker = tickers[symbol];

  if (!ticker) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Spinner size="large" label={`Connecting to Market Gateway for ${symbol}...`} />
      </div>
    );
  }

  const isHighVol = ticker.volatility > 10;

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: tokens.colorBrandBackground2, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <ArrowTrendingLines24Regular color={tokens.colorBrandForeground2} />
          </div>
          <div>
            <Text size={800} weight="bold">{symbol}</Text>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <Badge color={ticker.trend === "up" ? "success" : "danger"} shape="rounded">
                {ticker.trend === "up" ? "▲" : "▼"} {ticker.price.toLocaleString()}
              </Badge>
              {isHighVol && (
                <Badge color="warning" shape="rounded">High Volatility ({ticker.volatility.toFixed(1)})</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3-COLUMN LAYOUT */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* LEFT: ORDER BOOK */}
        <OrderBook currentPrice={ticker.price} />

        {/* MIDDLE: CHART */}
        <LivePriceChart symbol={symbol} currentPrice={ticker.price} />

        {/* RIGHT: ORDER FORM */}
        <OrderForm symbol={symbol} currentPrice={ticker.price} />

      </div>
    </div>
  );
};