import { useState } from "react";
import { Text, Button, Input, Spinner, tokens } from "@fluentui/react-components";
import { orderService } from "../services/orderService";
import { useNotificationStore } from "../../../shared/store/notificationStore";
import styles from "./TradePanel.module.scss";

interface TradePanelProps {
  symbol: string;
  currentPrice: number;
}

export const TradePanel = ({ symbol, currentPrice }: TradePanelProps) => {
  const [quantity, setQuantity] = useState("1");
  const [isTrading, setIsTrading] = useState(false);
  const { addNotification } = useNotificationStore();

  const total = Number(quantity) * currentPrice;

  const handleTrade = async (side: 1 | 2) => {
    const qty = Number(quantity);
    
    if (qty <= 0) {
      addNotification("Quantity must be greater than 0", "error");
      return;
    }

    setIsTrading(true);
    
    try {
      await orderService.placeOrder({
        symbol,
        side, // 1 = Buy, 2 = Sell
        type: 1, // 1 = Market Order
        quantity: qty
      });
      
      // We show an 'info' toast that it was sent. 
      // SignalR will pop up the 'success' toast when the matching engine actually fills it!
      addNotification(`Order submitted to engine: ${side === 1 ? 'Buy' : 'Sell'} ${qty} ${symbol}`, "info");
      
    } catch (error: any) {
      console.error("Trade execution failed:", error);
      addNotification(error.response?.data || "Failed to place order.", "error");
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <div 
      className={styles.panelContainer}
      style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}` }}
    >
      <div className={styles.row}>
        <Text size={200}>Quantity</Text>
        <Input 
          type="number" 
          value={quantity} 
          onChange={(_, data) => setQuantity(data.value)} 
          className={styles.quantityInput}
          min="0.01"
          step="0.01"
          disabled={isTrading}
        />
      </div>
      
      <div className={styles.row}>
        <Text size={200}>Total Value</Text>
        <Text weight="semibold">
          ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </div>

      <div className={styles.buttonGroup}>
        <Button 
          appearance="primary" 
          className={styles.actionButton}
          style={{ backgroundColor: tokens.colorPaletteGreenBackground3 }}
          onClick={() => handleTrade(1)}
          disabled={isTrading}
          icon={isTrading ? <Spinner size="tiny" /> : undefined}
        >
          Buy {symbol}
        </Button>
        <Button 
          appearance="primary" 
          className={styles.actionButton}
          style={{ backgroundColor: tokens.colorPaletteRedBackground3 }}
          onClick={() => handleTrade(2)}
          disabled={isTrading}
          icon={isTrading ? <Spinner size="tiny" /> : undefined}
        >
          Sell {symbol}
        </Button>
      </div>
    </div>
  );
};