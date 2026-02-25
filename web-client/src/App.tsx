import { useEffect } from "react";
import { signalRService } from "./services/customSignalRService";
import { useMarketStore } from "./store/marketStore";
import { SentimentWidget } from "./components/SentimentWidget";
import { AuthWidget } from "./components/AuthWidget";
import { TradePanel } from "./components/TradePanel";
import { ToastContainer } from "./components/toast/ToastContainer";
import { useAuthStore } from "./store/authStore";

const WATCH_LIST = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

function App() {
  const token = useAuthStore((state) => state.token);
  const tickers = useMarketStore((state) => state.tickers);

  useEffect(() => {
    const init = async () => {
      await signalRService.startConnection();
      WATCH_LIST.forEach((symbol) => signalRService.joinGroup(symbol));
    };
    init();
  }, [token]);

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "Arial, sans-serif",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h1>Crypto Thesis Dashboard</h1>

      {/* Grid Layout: Prices on Left, AI & Auth on Right */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "2rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Price Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1rem",
          }}
        >
          {WATCH_LIST.map((symbol) => {
            const ticker = tickers[symbol];

            if (!ticker)
              return (
                <div key={symbol} style={cardStyle}>
                  <h3>{symbol}</h3>
                  <p>Waiting for data...</p>
                </div>
              );

            const color =
              ticker.trend === "up"
                ? "green"
                : ticker.trend === "down"
                  ? "red"
                  : "black";

            return (
              <div key={symbol} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3 style={{ margin: 0 }}>{symbol}</h3>
                  <small style={{ color: "#888" }}>
                    {new Date(ticker.timestamp).toLocaleTimeString()}
                  </small>
                </div>

                <h2 style={{ color, margin: "15px 0 5px 0" }}>
                  ${ticker.price.toFixed(2)}
                </h2>

                {/* The new Trade Panel injection */}
                <TradePanel symbol={symbol} currentPrice={ticker.price} />
              </div>
            );
          })}
        </div>

        {/* Right Column: Auth & AI Widgets */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <AuthWidget />
          <SentimentWidget />
          <ToastContainer />
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "1.5rem",
  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
  backgroundColor: "#fff",
  display: "flex",
  flexDirection: "column",
  color: "black"
};

export default App;
