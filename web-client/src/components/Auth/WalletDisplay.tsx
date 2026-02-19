import { useState, useEffect, useCallback } from "react";
import { walletService } from "../../services/walletService";
import { useAuthStore } from "../../store/authStore";
import type { WalletResponse } from "../../dtos/WalletDtos";

export const WalletDisplay = () => {
  const { username, logout } = useAuthStore();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await walletService.getMyWallet();
      setWallet(data);
    } catch (err) {
      console.error("Failed to fetch wallet", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  return (
    <div>
      <h3>👤 Account</h3>
      <p>
        Welcome back, <strong>{username}</strong>!
      </p>

      <div style={walletBoxStyle}>
        <h4>💰 Your Wallet</h4>
        {loading && !wallet ? (
          <p>Loading balances...</p>
        ) : wallet && wallet.balances.length > 0 ? (
          wallet.balances.map((b) => (
            <div
              key={b.currency}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
              }}
            >
              <span>{b.currency}:</span>
              <strong>
                {b.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
          ))
        ) : (
          <p>Wallet is empty.</p>
        )}
        <button
          onClick={fetchWallet}
          style={refreshButtonStyle}
          disabled={loading}
        >
          {loading ? "↻ Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      <button onClick={logout} style={logoutButtonStyle}>
        Log Out
      </button>
    </div>
  );
};

const walletBoxStyle: React.CSSProperties = {
  backgroundColor: "#f8f9fa",
  padding: "10px",
  borderRadius: "6px",
  marginTop: "15px",
  marginBottom: "15px",
  border: "1px solid #eee",
};
const buttonStyle: React.CSSProperties = {
  padding: "10px",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
  width: "100%",
};
const logoutButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#dc3545",
};
const refreshButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#007bff",
  cursor: "pointer",
  fontSize: "0.8rem",
  marginTop: "10px",
  padding: 0,
};
