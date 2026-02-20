import { useState } from "react";
import { orderService } from "../services/orderService";
import { useAuthStore } from "../store/authStore";
import { useWalletStore } from "../store/walletStore";

interface TradePanelProps {
  symbol: string;
  currentPrice: number;
}

export const TradePanel = ({ symbol, currentPrice }: TradePanelProps) => {
  const { isAuthenticated } = useAuthStore();
  const { fetchWallet } = useWalletStore();

  const [side, setSide] = useState<1 | 2>(1); // 1 = Buy, 2 = Sell
  const [quantity, setQuantity] = useState<number>(0.05);
  const [targetPrice, setTargetPrice] = useState<number>(currentPrice);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  if (!isAuthenticated()) {
    return (
      <div
        style={{
          marginTop: "15px",
          borderTop: "1px solid #eee",
          paddingTop: "10px",
          fontSize: "0.85rem",
          color: "#666",
          textAlign: "center",
        }}
      >
        Log in to trade {symbol}
      </div>
    );
  }

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // We force type = 2 (Limit Order) because our MVP backend requires a target price
      const response = await orderService.placeOrder({
        symbol,
        side,
        type: 2,
        quantity,
        targetPrice,
      });
      setMessage({
        text: response.message || "Order placed successfully!",
        isError: false,
      });

      // 3. ✨ AUTOMATICALLY UPDATE THE WALLET! ✨
      await fetchWallet();
    } catch (err: any) {
      setMessage({
        text: err.response?.data || "Failed to place order.",
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: "15px",
        borderTop: "1px solid #eee",
        paddingTop: "10px",
      }}
    >
      <form
        onSubmit={handleTrade}
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        {/* Buy / Sell Toggle */}
        <div style={{ display: "flex", gap: "5px" }}>
          <button
            type="button"
            onClick={() => setSide(1)}
            style={{
              ...sideBtnStyle,
              backgroundColor: side === 1 ? "#28a745" : "#e9ecef",
              color: side === 1 ? "white" : "black",
            }}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide(2)}
            style={{
              ...sideBtnStyle,
              backgroundColor: side === 2 ? "#dc3545" : "#e9ecef",
              color: side === 2 ? "white" : "black",
            }}
          >
            Sell
          </button>
        </div>

        {/* Inputs */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.85rem",
          }}
        >
          <label>Qty:</label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            style={inputStyle}
            required
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.85rem",
          }}
        >
          <label>Limit Price:</label>
          <input
            type="number"
            step="0.01"
            value={targetPrice}
            onChange={(e) => setTargetPrice(Number(e.target.value))}
            style={inputStyle}
            required
          />
        </div>

        {/* Total Cost Calculation */}
        <div style={{ fontSize: "0.8rem", textAlign: "right", color: "#666" }}>
          Total: $
          {(quantity * targetPrice).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            ...submitBtnStyle,
            backgroundColor: side === 1 ? "#28a745" : "#dc3545",
          }}
        >
          {loading
            ? "Processing..."
            : `Place ${side === 1 ? "Buy" : "Sell"} Order`}
        </button>

        {/* Result Message */}
        {message && (
          <div
            style={{
              fontSize: "0.85rem",
              color: message.isError ? "red" : "green",
              marginTop: "5px",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
};

// --- STYLES ---
const sideBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
  transition: "0.2s",
};
const inputStyle: React.CSSProperties = {
  width: "90px",
  padding: "4px 6px",
  borderRadius: "4px",
  border: "1px solid #ccc",
};
const submitBtnStyle: React.CSSProperties = {
  padding: "8px",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
  marginTop: "5px",
};
