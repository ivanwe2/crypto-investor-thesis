import { Card, CardHeader, Spinner, tokens, Text, makeStyles, shorthands } from "@fluentui/react-components";
import { useEffect, useState, useMemo } from "react";
import { marketService } from "../../services/marketService";
import type { OrderBookEntryDto } from "../../models/Dtos";

// ✨ Griffel CSS-in-JS styling for deep pseudo-element control
const useStyles = makeStyles({
  card: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
    height: "400px",
    display: "flex",
    flexDirection: "column",
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
    ...shorthands.padding("0", "8px"),
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
    marginTop: "8px",
  },
  scrollArea: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("2px"),
    marginTop: "4px",
    fontFamily: "monospace",
    flexGrow: 1,
    overflowY: "auto",
    overflowX: "hidden",
    // ✨ Cross-browser Scrollbar Hiding!
    scrollbarWidth: "none", // Firefox
    msOverflowStyle: "none", // IE/Edge
    "::-webkit-scrollbar": {
      display: "none", // Chrome/Safari
    },
  },
  depthRow: {
    position: "relative",
    ...shorthands.padding("2px", "8px"),
    display: "flex",
    justifyContent: "space-between",
  },
  spreadDivider: {
    textAlign: "center",
    ...shorthands.margin("8px", "0"),
    ...shorthands.padding("8px", "0"),
    backgroundColor: tokens.colorNeutralBackground2,
    fontSize: "16px",
    fontWeight: "bold",
    color: tokens.colorBrandForeground1,
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke1),
  }
});

export const OrderBook = ({ currentPrice, symbol }: { currentPrice: number, symbol: string }) => {
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
      <CardHeader header={<Text weight="semibold" size={500}>Order Book Depth</Text>} />
      
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
            {/* ASKS */}
            {asks.map((ask, i) => {
              const depthPercent = (ask.size / maxSize) * 100;
              return (
                <div key={`ask-${i}`} className={styles.depthRow}>
                  <div style={{
                    position: "absolute", right: 0, top: 0, bottom: 0,
                    width: `${depthPercent}%`,
                    backgroundColor: tokens.colorPaletteRedBackground1,
                    opacity: 0.3,
                    zIndex: 0
                  }} />
                  <span style={{ color: tokens.colorPaletteRedForeground1, zIndex: 1 }}>{ask.price.toFixed(2)}</span>
                  <span style={{ zIndex: 1, color: tokens.colorNeutralForeground1 }}>{ask.size.toFixed(4)}</span>
                </div>
              );
            })}

            {/* SPREAD */}
            <div className={styles.spreadDivider}>
              ${currentPrice ? currentPrice.toLocaleString() : '---'}
            </div>

            {/* BIDS */}
            {bids.map((bid, i) => {
              const depthPercent = (bid.size / maxSize) * 100;
              return (
                <div key={`bid-${i}`} className={styles.depthRow}>
                  <div style={{
                    position: "absolute", right: 0, top: 0, bottom: 0,
                    width: `${depthPercent}%`,
                    backgroundColor: tokens.colorPaletteGreenBackground1,
                    opacity: 0.3,
                    zIndex: 0
                  }} />
                  <span style={{ color: tokens.colorPaletteGreenForeground1, zIndex: 1 }}>{bid.price.toFixed(2)}</span>
                  <span style={{ zIndex: 1, color: tokens.colorNeutralForeground1 }}>{bid.size.toFixed(4)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
};