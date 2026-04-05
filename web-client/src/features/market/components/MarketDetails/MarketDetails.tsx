import { ArrowTrendingLines24Regular } from "@fluentui/react-icons";
import { useMarketStore } from "../../store/marketStore";
import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Spinner,
  Text,
  Dropdown,
  Option,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import { OrderBook } from "./OrderBook";
import { LivePriceChart } from "./LivePriceChart";
import { OrderForm } from "./OrderForm";
import { useMemo } from "react";
import { formatPrice } from "../../../../shared/utils/formatPrice";

const useStyles = makeStyles({
  page: {
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("20px"),
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    animation: "ct-fade-in 0.3s ease-out both",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("14px"),
  },
  symbolIcon: {
    width: "44px",
    height: "44px",
    ...shorthands.borderRadius("50%"),
    background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))",
    ...shorthands.border("1px", "solid", "var(--ct-border-brand)"),
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  symbolName: {
    fontFamily: "var(--ct-font-sans)",
    letterSpacing: "-0.03em",
  },
  badgeRow: {
    display: "flex",
    ...shorthands.gap("8px"),
    marginTop: "4px",
  },
  threeCol: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 1fr",
    ...shorthands.gap("16px"),
    alignItems: "start",
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
    },
  },
  loadingState: {
    ...shorthands.padding("60px"),
    textAlign: "center",
  },
});

export const MarketDetailPage = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const { symbol = "BTCUSDT" } = useParams<{ symbol: string }>();

  const tickers = useMarketStore((state) => state.tickers);
  const ticker = tickers[symbol];

  const availableSymbols = useMemo(() => Object.keys(tickers), [tickers]);

  if (!ticker) {
    return (
      <div className={styles.loadingState}>
        <Spinner
          size="large"
          label={`Connecting to Market Gateway for ${symbol}...`}
        />
      </div>
    );
  }

  const isHighVol = ticker.volatility > 10;

  const handleSymbolChange = (
    _: any,
    data: { optionValue: string | undefined },
  ) => {
    if (data.optionValue) {
      navigate(`/market/${data.optionValue}`);
    }
  };

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.symbolIcon}>
            <ArrowTrendingLines24Regular style={{ color: "var(--ct-brand)" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Text size={800} weight="bold" className={styles.symbolName}>
                {symbol.replace("USDT", "")}
              </Text>
              <Text size={300} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-mono)" }}>
                / USDT
              </Text>

              {availableSymbols.length > 1 && (
                <Dropdown
                  aria-labelledby="symbol-selector"
                  placeholder="Switch"
                  value={symbol}
                  onOptionSelect={handleSymbolChange}
                  style={{ minWidth: "130px" }}
                  size="small"
                >
                  {availableSymbols.map((sym) => (
                    <Option key={sym} value={sym}>
                      {sym}
                    </Option>
                  ))}
                </Dropdown>
              )}
            </div>

            <div className={styles.badgeRow}>
              <Badge
                color={ticker.trend === "up" ? "success" : "danger"}
                shape="rounded"
                appearance="filled"
                style={{
                  fontFamily: "var(--ct-font-mono)",
                  fontSize: "12px",
                  boxShadow: ticker.trend === "up" ? "var(--ct-glow-bullish)" : "var(--ct-glow-bearish)",
                }}
              >
                {ticker.trend === "up" ? "+" : "-"} ${formatPrice(ticker.price)}
              </Badge>
              {isHighVol && (
                <Badge color="warning" shape="rounded" appearance="tint">
                  High Volatility ({ticker.volatility.toFixed(1)})
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3-COLUMN LAYOUT */}
      <div className={styles.threeCol}>
        <OrderBook currentPrice={ticker.price} symbol={ticker.symbol} />
        <LivePriceChart symbol={symbol} currentPrice={ticker.price} />
        <OrderForm symbol={symbol} currentPrice={ticker.price} />
      </div>
    </div>
  );
};
