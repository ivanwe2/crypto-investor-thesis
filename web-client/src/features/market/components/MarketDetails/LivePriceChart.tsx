import { Badge, Card, CardHeader, Spinner, tokens, Text } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { marketService } from "../../services/marketService";

// --- CUSTOM SVG CANDLESTICK SHAPE ---
// Recharts passes the raw data payload directly to the shape, so we evaluate colors here!
const CustomCandlestick = (props: any) => {
  const { x, y, width, height, payload } = props;
  const isUp = payload.close >= payload.open;
  // Use Fluent UI tokens for consistent theming
  const color = isUp ? tokens.colorPaletteGreenBackground3 : tokens.colorPaletteRedBackground3;
  
  const bodySpread = Math.abs(payload.open - payload.close) || 0.001; 
  const pixelPerDollar = height / bodySpread;
  
  const highY = y - (payload.high - Math.max(payload.open, payload.close)) * pixelPerDollar;
  const lowY = y + height + (Math.min(payload.open, payload.close) - payload.low) * pixelPerDollar;
  
  const centerX = x + width / 2;

  return (
    <g stroke={color} fill={color} strokeWidth={2}>
      <line x1={centerX} y1={highY} x2={centerX} y2={y} />
      <rect x={x} y={y} width={width} height={Math.max(height, 1)} />
      <line x1={centerX} y1={y + height} x2={centerX} y2={lowY} />
    </g>
  );
};

// --- CUSTOM TOOLTIP FOR PREMIUM HFT FEEL ---
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isUp = data.close >= data.open;
    const color = isUp ? tokens.colorPaletteGreenForeground1 : tokens.colorPaletteRedForeground1;

    return (
      <div style={{
        backgroundColor: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: tokens.shadow16
      }}>
        <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3, marginBottom: '8px', display: 'block' }}>
          {data.time}
        </Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <Text size={200}>Open: <span style={{ fontWeight: 'bold' }}>{data.open.toFixed(2)}</span></Text>
          <Text size={200}>High: <span style={{ fontWeight: 'bold' }}>{data.high.toFixed(2)}</span></Text>
          <Text size={200}>Low: <span style={{ fontWeight: 'bold' }}>{data.low.toFixed(2)}</span></Text>
          <Text size={200}>Close: <span style={{ fontWeight: 'bold', color }}>{data.close.toFixed(2)}</span></Text>
        </div>
      </div>
    );
  }
  return null;
};

export const LivePriceChart = ({ symbol, currentPrice }: { symbol: string; currentPrice?: number }) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. INITIAL LOAD: Fetch historical REST data
  useEffect(() => {
    let isMounted = true;

    const fetchKlines = async () => {
      try {
        setIsLoading(true);
        const response = await marketService.getHistoricalKlines(symbol, "1m", 40);
        
        if (!isMounted) return;

        const formattedData = response.klines.map(k => ({
          time: new Date(k.startTimeUtc * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: k.open,
          close: k.close,
          high: k.high,
          low: k.low,
          body: [Math.min(k.open, k.close), Math.max(k.open, k.close)],
        }));

        setData(formattedData);
      } catch (error) {
        console.error("Failed to fetch klines:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchKlines();
    return () => { isMounted = false; };
  }, [symbol]);

  // 2. SIGNALR INTEGRATION: Update the live candle dynamically
  useEffect(() => {
    if (currentPrice && data.length > 0) {
      setData(prevData => {
        const newData = [...prevData];
        const lastIndex = newData.length - 1;
        
        // Create an immutable copy of the last candle
        const lastCandle = { ...newData[lastIndex] };
        
        lastCandle.close = currentPrice;
        lastCandle.high = Math.max(lastCandle.high, currentPrice);
        lastCandle.low = Math.min(lastCandle.low, currentPrice);
        lastCandle.body = [Math.min(lastCandle.open, lastCandle.close), Math.max(lastCandle.open, lastCandle.close)];
        
        newData[lastIndex] = lastCandle;
        return newData;
      });
    }
  }, [currentPrice]); // Triggered every time SignalR updates the Zustand store!

  return (
    <Card style={{ height: 400, backgroundColor: tokens.colorNeutralBackground1Hover }}>
      <CardHeader 
        header={<Text weight="semibold" size={500}>{symbol} 1m Chart</Text>} 
        action={<Badge appearance="tint" color="success" shape="rounded">SignalR Live</Badge>}
      />
      <div style={{ width: "100%", height: 320 }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Spinner label={`Loading history...`} />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
              <XAxis dataKey="time" stroke={tokens.colorNeutralStroke1} fontSize={12} tickLine={false} />
              <YAxis 
                domain={['auto', 'auto']} 
                stroke={tokens.colorNeutralStroke1} 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.colorNeutralStroke2} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: tokens.colorNeutralBackground1Hover, opacity: 0.4 }} />
              
              {/* No more <Cell> required. The custom shape evaluates payload directly */}
              <Bar dataKey="body" shape={<CustomCandlestick />} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};