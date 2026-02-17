import { useEffect } from 'react';
import { signalRService } from './services/SignalRService';
import { useMarketStore } from './hooks/useMarketStore';
import { SentimentWidget } from './components/SentimentWidget';

const WATCH_LIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

function App() {
  const tickers = useMarketStore((state) => state.tickers);

  useEffect(() => {
    const init = async () => {
      await signalRService.startConnection();
      WATCH_LIST.forEach(symbol => signalRService.joinGroup(symbol));
    };
    init();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto', display: 'flex' }}>
      <h1>Crypto Thesis Dashboard</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
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
                <small>Last: {new Date(ticker.timestamp).toLocaleTimeString()}</small>
              </div>
            );
          })}
        </div>

        <SentimentWidget />
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