import { Badge, Card, Spinner, Text, makeStyles, shorthands } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { marketService } from "../../services/marketService";

const useStyles = makeStyles({
  card: {
    height: "420px",
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    animation: "ct-fade-in 0.4s ease-out 0.1s both",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...shorthands.padding("16px", "16px", "0", "16px"),
  },
  chartArea: {
    width: "100%",
    height: "340px",
    ...shorthands.padding("0", "8px", "8px", "8px"),
  },
  loadingState: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  liveBadge: {
    fontFamily: "var(--ct-font-mono)",
    fontSize: "10px",
    letterSpacing: "0.06em",
  },
});

// Custom SVG Candlestick Shape
const CustomCandlestick = (props: any) => {
  const { x, y, width, height, payload } = props;
  const isUp = payload.close >= payload.open;
  const color = isUp ? "#22C55E" : "#EF4444";

  const bodySpread = Math.abs(payload.open - payload.close) || 0.001;
  const pixelPerDollar = height / bodySpread;

  const highY = y - (payload.high - Math.max(payload.open, payload.close)) * pixelPerDollar;
  const lowY = y + height + (Math.min(payload.open, payload.close) - payload.low) * pixelPerDollar;

  const centerX = x + width / 2;

  return (
    <g stroke={color} fill={isUp ? color : color} strokeWidth={1.5} opacity={0.9}>
      <line x1={centerX} y1={highY} x2={centerX} y2={y} />
      <rect x={x + 1} y={y} width={Math.max(width - 2, 2)} height={Math.max(height, 1)} rx={1} />
      <line x1={centerX} y1={y + height} x2={centerX} y2={lowY} />
    </g>
  );
};

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isUp = data.close >= data.open;
    const color = isUp ? "#22C55E" : "#EF4444";

    return (
      <div style={{
        backgroundColor: "var(--ct-bg-elevated)",
        border: "1px solid var(--ct-border-hover)",
        borderRadius: "var(--ct-radius-md)",
        padding: "12px",
        boxShadow: "var(--ct-shadow-elevated)",
        fontFamily: "var(--ct-font-mono)",
      }}>
        <div style={{ color: "var(--ct-text-muted)", marginBottom: "8px", fontSize: "11px" }}>
          {data.time}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: "12px" }}>
          <span style={{ color: "var(--ct-text-secondary)" }}>O: <b style={{ color: "var(--ct-text-primary)" }}>{data.open.toFixed(2)}</b></span>
          <span style={{ color: "var(--ct-text-secondary)" }}>H: <b style={{ color: "var(--ct-text-primary)" }}>{data.high.toFixed(2)}</b></span>
          <span style={{ color: "var(--ct-text-secondary)" }}>L: <b style={{ color: "var(--ct-text-primary)" }}>{data.low.toFixed(2)}</b></span>
          <span style={{ color: "var(--ct-text-secondary)" }}>C: <b style={{ color }}>{data.close.toFixed(2)}</b></span>
        </div>
      </div>
    );
  }
  return null;
};

export const LivePriceChart = ({ symbol, currentPrice }: { symbol: string; currentPrice?: number }) => {
  const styles = useStyles();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (currentPrice && data.length > 0) {
      setData(prevData => {
        const newData = [...prevData];
        const lastIndex = newData.length - 1;
        const lastCandle = { ...newData[lastIndex] };

        lastCandle.close = currentPrice;
        lastCandle.high = Math.max(lastCandle.high, currentPrice);
        lastCandle.low = Math.min(lastCandle.low, currentPrice);
        lastCandle.body = [Math.min(lastCandle.open, lastCandle.close), Math.max(lastCandle.open, lastCandle.close)];

        newData[lastIndex] = lastCandle;
        return newData;
      });
    }
  }, [currentPrice]);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Text weight="semibold" size={400} style={{ fontFamily: "var(--ct-font-sans)" }}>
          {symbol} <span style={{ color: "var(--ct-text-muted)", fontWeight: 400 }}>1m</span>
        </Text>
        <Badge appearance="filled" color="success" shape="rounded" className={styles.liveBadge}>
          LIVE
        </Badge>
      </div>
      <div className={styles.chartArea}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <Spinner label="Loading chart data..." />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
              <XAxis
                dataKey="time"
                stroke="var(--ct-border-hover)"
                fontSize={10}
                fontFamily="var(--ct-font-mono)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                stroke="var(--ct-border-hover)"
                fontSize={10}
                fontFamily="var(--ct-font-mono)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
              <Bar dataKey="body" shape={<CustomCandlestick />} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};
