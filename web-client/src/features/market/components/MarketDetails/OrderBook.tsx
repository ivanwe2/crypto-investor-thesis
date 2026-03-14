import { Card, CardHeader, Spinner, tokens, Text } from "@fluentui/react-components";
import { useEffect, useState, useMemo } from "react";
import { marketService } from "../../services/marketService";
import type { OrderBookEntryDto } from "../../models/Dtos";

export const OrderBook = ({ currentPrice, symbol }: { currentPrice: number, symbol: string }) => {
  const [asks, setAsks] = useState<OrderBookEntryDto[]>([]);
  const [bids, setBids] = useState<OrderBookEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial Load: Fetch Depth Snapshot via REST
  useEffect(() => {
    let isMounted = true;
    
    const fetchOrderBookSnapshot = async () => {
      try {
        setIsLoading(true);
        const data = await marketService.getOrderBookDepth(symbol, 12);
        if (isMounted) {
          // Asks are typically returned ascending. We reverse them so the lowest price is near the spread center.
          setAsks([...data.asks].sort((a, b) => b.price - a.price));
          // Bids are typically returned descending. Highest price near the center.
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
    <Card style={{ backgroundColor: tokens.colorNeutralBackground1Hover, height: 400 }}>
      <CardHeader header={<Text weight="semibold" size={500}>Order Book Depth</Text>} />
      
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
           <Spinner size="small" label="Loading depth..." />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", color: tokens.colorNeutralForeground3, fontSize: "12px", marginTop: "8px" }}>
            <span>Price</span>
            <span>Size</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px", fontFamily: "monospace", flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            
            {/* ASKS (Red, descending) */}
            {asks.map((ask, i) => {
              const depthPercent = (ask.size / maxSize) * 100;
              return (
                <div key={`ask-${i}`} style={{ position: "relative", padding: "2px 8px", display: "flex", justifyContent: "space-between" }}>
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

            {/* SPREAD / SIGNALR CURRENT PRICE */}
            <div style={{ 
              textAlign: "center", 
              margin: "8px 0", 
              padding: "8px 0", 
              backgroundColor: tokens.colorNeutralBackground2, 
              fontSize: "16px", 
              fontWeight: "bold", 
              color: tokens.colorBrandForeground1, // Highlight color
              borderTop: `1px solid ${tokens.colorNeutralStroke1}`, 
              borderBottom: `1px solid ${tokens.colorNeutralStroke1}` 
            }}>
              ${currentPrice ? currentPrice.toLocaleString() : '---'}
            </div>

            {/* BIDS (Green, descending) */}
            {bids.map((bid, i) => {
              const depthPercent = (bid.size / maxSize) * 100;
              return (
                <div key={`bid-${i}`} style={{ position: "relative", padding: "2px 8px", display: "flex", justifyContent: "space-between" }}>
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
        </div>
      )}
    </Card>
  );
};