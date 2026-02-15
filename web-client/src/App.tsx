import { useEffect } from 'react';
import { signalRService } from './services/SignalRService';
import { useMarketStore } from './hooks/useMarketStore';

const WATCH_LIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

function App() {
  const tickers = useMarketStore((state) => state.tickers);

  useEffect(() => {
    const init = async () => {
      await signalRService.startConnection();
      
      // Subscribe to all coins in our watch list
      WATCH_LIST.forEach(symbol => {
        signalRService.joinGroup(symbol);
      });
    };

    init();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Crypto Thesis Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        
        {WATCH_LIST.map((symbol) => {
          const ticker = tickers[symbol];
          
          if (!ticker) return (
            <div key={symbol} style={cardStyle}>
              <h3>{symbol}</h3>
              <p>Waiting for data...</p>
            </div>
          );

          const color = ticker.trend === 'up' ? 'green' : ticker.trend === 'down' ? 'red' : 'black';

          return (
            <div key={symbol} style={cardStyle}>
              <h3>{symbol}</h3>
              <h2 style={{ color, margin: '10px 0' }}>
                ${ticker.price.toFixed(2)}
              </h2>
              <small>Last Update: {new Date(ticker.timestamp).toLocaleTimeString()}</small>
            </div>
          );
        })}

      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: '8px',
  padding: '1.5rem',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  backgroundColor: '#fff',
  color: 'black'
};

export default App;