import { useState, useEffect } from "react";
import { Text, Button, Input, Spinner, RadioGroup, Radio, tokens } from "@fluentui/react-components";
import { orderService } from "../services/orderService";
import { useNotificationStore } from "../../../shared/store/notificationStore";
import styles from "./TradePanel.module.scss";

interface TradePanelProps {
  symbol: string;
  currentPrice: number;
}

export const TradePanel = ({ symbol, currentPrice }: TradePanelProps) => {
  const [orderType, setOrderType] = useState<"1" | "2">("2"); // "1" = Market, "2" = Limit
  const [quantity, setQuantity] = useState("1");
  const [targetPrice, setTargetPrice] = useState(currentPrice.toString());
  const [isTrading, setIsTrading] = useState(false);
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!isTrading && orderType === "2") {
      setTargetPrice((prev) => prev === "" ? currentPrice.toString() : prev);
    }
  }, [currentPrice, isTrading, orderType]);

  const effectivePrice = orderType === "2" ? Number(targetPrice) : currentPrice;
  const total = Number(quantity) * effectivePrice;

  const handleTrade = async (side: 1 | 2) => {
    const qty = Number(quantity);
    const price = Number(targetPrice);
    const typeNum = Number(orderType) as 1 | 2;
    
    if (qty <= 0) {
      addNotification("Quantity must be greater than 0", "error");
      return;
    }

    if (typeNum === 2 && price <= 0) {
      addNotification("Limit Price must be greater than 0", "error");
      return;
    }

    setIsTrading(true);
    
    try {
      await orderService.placeOrder({
        symbol,
        side, 
        type: typeNum, 
        quantity: qty,
        targetPrice: typeNum === 2 ? price : undefined
      });
      
      const orderTypeName = typeNum === 1 ? 'Market' : 'Limit';
      const priceText = typeNum === 1 ? 'Market Price' : `@ $${price}`;
      addNotification(`${orderTypeName} order submitted: ${side === 1 ? 'Buy' : 'Sell'} ${qty} ${symbol} ${priceText}`, "info");
      
    } catch (error: any) {
      console.error("Trade execution failed:", error);
      addNotification(error.response?.data?.message || error.response?.data || "Failed to place order.", "error");
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <div className={styles.panelContainer} style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}` }}>
      
      <div style={{ marginBottom: "8px" }}>
        <RadioGroup 
          value={orderType} 
          onChange={(_, data) => setOrderType(data.value as "1" | "2")} 
          layout="horizontal"
        >
          <Radio value="1" label="Market" disabled={isTrading} />
          <Radio value="2" label="Limit" disabled={isTrading} />
        </RadioGroup>
      </div>

      <div className={styles.row}>
        <Text size={200}>Quantity</Text>
        <Input 
          type="number" value={quantity} onChange={(_, data) => setQuantity(data.value)} 
          className={styles.quantityInput} min="0.01" step="0.01" disabled={isTrading}
        />
      </div>
      
      {orderType === "2" && (
        <div className={styles.row}>
          <Text size={200}>Limit Price</Text>
          <Input 
            type="number" value={targetPrice} onChange={(_, data) => setTargetPrice(data.value)} 
            className={styles.quantityInput} min="0.01" step="0.01" disabled={isTrading}
          />
        </div>
      )}

      <div className={styles.row}>
        <Text size={200}>{orderType === "1" ? "Est. Total Value" : "Total Value"}</Text>
        <Text weight="semibold">
          ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </div>

      <div className={styles.buttonGroup}>
        <Button 
          appearance="primary" className={styles.actionButton}
          style={{ backgroundColor: tokens.colorPaletteGreenBackground3 }}
          onClick={() => handleTrade(1)} disabled={isTrading} icon={isTrading ? <Spinner size="tiny" /> : undefined}
        >
          Buy {symbol}
        </Button>
        <Button 
          appearance="primary" className={styles.actionButton}
          style={{ backgroundColor: tokens.colorPaletteRedBackground3 }}
          onClick={() => handleTrade(2)} disabled={isTrading} icon={isTrading ? <Spinner size="tiny" /> : undefined}
        >
          Sell {symbol}
        </Button>
      </div>
    </div>
  );
};