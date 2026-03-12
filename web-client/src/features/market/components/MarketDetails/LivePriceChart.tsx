import { Badge, Card, CardHeader, Spinner, tokens, Text } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const LivePriceChart = ({ symbol, currentPrice }: { symbol: string; currentPrice: number }) => {
  const [data, setData] = useState<{ time: string; price: number }[]>([]);

  useEffect(() => {
    if (!currentPrice) return;
    setData(prev => {
      const now = new Date().toLocaleTimeString(undefined, { second: '2-digit', minute: '2-digit' });
      const newData = [...prev, { time: now, price: currentPrice }];
      if (newData.length > 30) newData.shift();
      return newData;
    });
  }, [currentPrice]);

  return (
    <Card style={{ height: 400, backgroundColor: tokens.colorNeutralBackground1Hover }}>
      <CardHeader 
        header={<Text weight="semibold" size={500}>{symbol} Live Chart</Text>} 
        action={
          <Badge appearance="tint" color="informative" shape="rounded">
            Real-time gRPC Stream
          </Badge>
        }
      />
      <div style={{ width: "100%", height: 320 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" stroke={tokens.colorNeutralStroke1} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                domain={['auto', 'auto']} 
                stroke={tokens.colorNeutralStroke1} 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.colorNeutralStroke2} />
              <Tooltip 
                contentStyle={{ backgroundColor: tokens.colorNeutralBackground1, borderColor: tokens.colorNeutralStroke1, borderRadius: '8px' }}
                itemStyle={{ color: tokens.colorBrandForeground1 }}
                formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Price']}
                labelStyle={{ color: tokens.colorNeutralForeground3 }}
              />
              <Line 
                type="stepAfter" 
                dataKey="price" 
                stroke={tokens.colorBrandBackground} 
                strokeWidth={3} 
                dot={false}
                isAnimationActive={false} // Turn off animation for snappy HFT feel
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Spinner label="Waiting for market data..." />
          </div>
        )}
      </div>
    </Card>
  );
};