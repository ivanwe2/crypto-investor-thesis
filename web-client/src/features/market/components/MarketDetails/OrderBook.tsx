import { Card, Spinner, Text, makeStyles, shorthands } from "@fluentui/react-components";
import { useEffect, useState, useMemo } from "react";
import { marketService } from "../../services/marketService";
import type { OrderBookEntryDto } from "../../models/Dtos";
import { formatPrice } from "../../../../shared/utils/formatPrice";

const useStyles = makeStyles({
  card: {
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    height: "420px",
    display: "flex",
    flexDirection: "column",
    ...shorthands.overflow("hidden"),
    animation: "ct-fade-in 0.4s ease-out both",
  },
  header: {
    ...shorthands.padding("16px"),
    ...shorthands.borderBottom("1px", "solid", "var(--ct-border)"),
  },
  centerState: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
  },
  columnHeaders: {
    display: "flex",
    justifyContent: "space-between",
    ...shorthands.padding("8px", "12px"),
    fontFamily: "var(--ct-font-mono)",
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--ct-text-muted)",
  },
  scrollArea: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("1px"),
    fontFamily: "var(--ct-font-mono)",
    flexGrow: 1,
    overflowY: "auto",
    overflowX: "hidden",
    scrollbarWidth: "none",
  },
  depthRow: {
    position: "relative",
    ...shorthands.padding("3px", "12px"),
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    transitionProperty: "background-color",
    transitionDuration: "0.15s",
    ":hover": {
      backgroundColor: "rgba(255,255,255,0.03)",
    },
  },
  spreadDivider: {
    textAlign: "center",
    ...shorthands.margin("4px", "0"),
    ...shorthands.padding("8px", "0"),
    backgroundColor: "var(--ct-bg-elevated)",
    fontSize: "14px",
    fontWeight: "700",
    fontFamily: "var(--ct-font-mono)",
    color: "var(--ct-brand)",
    ...shorthands.borderTop("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderBottom("1px", "solid", "var(--ct-border)"),
    letterSpacing: "-0.02em",
  },
});

export const OrderBook = ({ currentPrice, symbol }: { currentPrice: number; symbol: string }) => {
  const styles = useStyles();
  const [asks, setAsks] = useState<OrderBookEntryDto[]>([]);
  const [bids, setBids] = useState<OrderBookEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchOrderBookSnapshot = async () => {
      try {
        setIsLoading(true);
        const data = await marketService.getOrderBookDepth(symbol, 12);
        if (isMounted) {
          setAsks([...data.asks].sort((a, b) => b.price - a.price));
          setBids([...data.bids].sort((a, b) => b.price - a.price));
        }
      } catch (error) {
        console.error("Failed to fetch order book depth:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchOrderBookSnapshot();
    return () => { isMounted = false; };
  }, [symbol]);

  const maxSize = useMemo(() => {
    const maxAsk = asks.length > 0 ? Math.max(...asks.map(a => a.size)) : 0;
    const maxBid = bids.length > 0 ? Math.max(...bids.map(b => b.size)) : 0;
    return Math.max(maxAsk, maxBid, 0.001);
  }, [asks, bids]);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Text weight="semibold" size={400} style={{ fontFamily: "var(--ct-font-sans)" }}>
          Order Book
        </Text>
      </div>

      {isLoading ? (
        <div className={styles.centerState}>
          <Spinner size="small" label="Loading depth..." />
        </div>
      ) : (
        <>
          <div className={styles.columnHeaders}>
            <span>Price</span>
            <span>Size</span>
          </div>

          <div className={styles.scrollArea}>
            {asks.map((ask, i) => {
              const depthPercent = (ask.size / maxSize) * 100;
              return (
                <div key={`ask-${i}`} className={styles.depthRow}>
                  <div style={{
                    position: "absolute", right: 0, top: 0, bottom: 0,
                    width: `${depthPercent}%`,
                    background: "linear-gradient(90deg, transparent, rgba(239,68,68,0.08))",
                    zIndex: 0,
                  }} />
                  <span style={{ color: "var(--ct-bearish)", zIndex: 1, fontWeight: 500 }}>
                    {formatPrice(ask.price)}
                  </span>
                  <span style={{ zIndex: 1, color: "var(--ct-text-secondary)" }}>
                    {ask.size.toFixed(4)}
                  </span>
                </div>
              );
            })}

            <div className={styles.spreadDivider}>
              ${currentPrice ? formatPrice(currentPrice) : '---'}
            </div>

            {bids.map((bid, i) => {
              const depthPercent = (bid.size / maxSize) * 100;
              return (
                <div key={`bid-${i}`} className={styles.depthRow}>
                  <div style={{
                    position: "absolute", right: 0, top: 0, bottom: 0,
                    width: `${depthPercent}%`,
                    background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.08))",
                    zIndex: 0,
                  }} />
                  <span style={{ color: "var(--ct-bullish)", zIndex: 1, fontWeight: 500 }}>
                    {formatPrice(bid.price)}
                  </span>
                  <span style={{ zIndex: 1, color: "var(--ct-text-secondary)" }}>
                    {bid.size.toFixed(4)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
};
