import { Card, CardHeader, tokens, Text } from "@fluentui/react-components";
import { useMemo } from "react";

export const OrderBook = ({ currentPrice }: { currentPrice: number }) => {
  // Generate a mock symmetric order book around the current price
  const asks = useMemo(() => Array.from({ length: 5 }).map((_, i) => ({
    price: currentPrice * (1 + (5-i)*0.001),
    size: Math.random() * 2 + 0.1
  })), [currentPrice]);

  const bids = useMemo(() => Array.from({ length: 5 }).map((_, i) => ({
    price: currentPrice * (1 - (i+1)*0.001),
    size: Math.random() * 2 + 0.1
  })), [currentPrice]);

  if (!currentPrice) return null;

  return (
    <Card style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}>
      <CardHeader header={<Text weight="semibold" size={500}>Order Book</Text>} />
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "12px", fontFamily: "monospace" }}>
        
        {asks.map((ask, i) => (
          <div key={`ask-${i}`} style={{ display: "flex", justifyContent: "space-between", color: tokens.colorPaletteRedForeground1 }}>
            <span>{ask.price.toFixed(2)}</span>
            <span>{ask.size.toFixed(4)}</span>
          </div>
        ))}

        <div style={{ textAlign: "center", margin: "8px 0", fontSize: "16px", fontWeight: "bold", color: tokens.colorNeutralForeground1 }}>
          ${currentPrice.toLocaleString()}
        </div>

        {bids.map((bid, i) => (
          <div key={`bid-${i}`} style={{ display: "flex", justifyContent: "space-between", color: tokens.colorPaletteGreenForeground1 }}>
            <span>{bid.price.toFixed(2)}</span>
            <span>{bid.size.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};