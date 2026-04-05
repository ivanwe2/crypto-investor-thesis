import { useEffect, useState, useMemo } from "react";
import { Card, Text, Spinner, makeStyles, shorthands } from "@fluentui/react-components";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { marketService } from "../../../market/services/marketService";

const useStyles = makeStyles({
  card: {
    height: "400px",
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    ...shorthands.padding("16px"),
    animation: "ct-fade-in 0.4s ease-out both",
  },
  header: {
    ...shorthands.margin("0", "0", "8px", "0"),
  },
  chartWrapper: {
    width: "100%",
    height: "300px",
    marginTop: "8px",
  },
  centerState: {
    display: "flex",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});

// Custom Tooltip
const ChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: "var(--ct-bg-elevated)",
        border: "1px solid var(--ct-border-hover)",
        borderRadius: "var(--ct-radius-md)",
        padding: "10px 14px",
        boxShadow: "var(--ct-shadow-elevated)",
      }}>
        <div style={{ color: "var(--ct-text-muted)", fontSize: "11px", fontFamily: "var(--ct-font-mono)" }}>
          {payload[0]?.payload?.date}
        </div>
        <div style={{ color: "var(--ct-text-primary)", fontSize: "16px", fontWeight: 700, fontFamily: "var(--ct-font-mono)", marginTop: 4 }}>
          ${Number(payload[0]?.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    );
  }
  return null;
};

export const PortfolioChart = ({ assets, totalValue }: { assets: any[]; totalValue: number }) => {
  const styles = useStyles();
  const [rawKlines, setRawKlines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const walletCompositionKey = useMemo(() => {
    return assets
      .filter(a => a.currency !== 'USDT' && a.currency !== 'USD')
      .map(a => a.currency)
      .sort()
      .join(',');
  }, [assets]);

  useEffect(() => {
    let isMounted = true;

    const fetchHistoricalData = async () => {
      if (!walletCompositionKey) {
        setRawKlines([]);
        return;
      }

      setIsLoading(true);
      try {
        const currencies = walletCompositionKey.split(',');
        const promises = currencies.map(currency =>
          marketService.getHistoricalKlines(`${currency}USDT`, "1d", 30)
            .then(res => ({ currency, klines: res.klines }))
            .catch(err => {
              console.warn(`Failed to fetch klines for ${currency}`, err);
              return null;
            })
        );

        const results = await Promise.all(promises);
        if (isMounted) setRawKlines(results.filter(r => r !== null));
      } catch (error) {
        console.error("Failed to fetch historical portfolio data:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistoricalData();
    return () => { isMounted = false; };
  }, [walletCompositionKey]);

  const chartData = useMemo(() => {
    if (assets.length === 0 || totalValue === 0) return [];

    const stableCoins = assets.filter(a => a.currency === 'USDT' || a.currency === 'USD');
    const stableValue = stableCoins.reduce((sum, a) => sum + a.amount, 0);

    if (rawKlines.length === 0) {
      const flatData = [];
      const now = new Date();
      for (let i = 30; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        flatData.push({ date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: stableValue });
      }
      flatData[flatData.length - 1].value = totalValue;
      return flatData;
    }

    const baseKlines = rawKlines[0].klines;
    const aggregated = baseKlines.map((baseKline: any, index: number) => {
      let dailyTotal = stableValue;

      rawKlines.forEach(rawAssetKlines => {
        const klineForDay = rawAssetKlines.klines[index];
        const currentWalletAsset = assets.find(a => a.currency === rawAssetKlines.currency);
        if (klineForDay && currentWalletAsset) {
          dailyTotal += (currentWalletAsset.amount * klineForDay.close);
        }
      });

      return {
        date: new Date(baseKline.startTimeUtc * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: dailyTotal
      };
    });

    if (aggregated.length > 0) {
      aggregated[aggregated.length - 1].value = totalValue;
    }

    return aggregated;
  }, [rawKlines, assets, totalValue]);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Text weight="semibold" size={400} style={{ fontFamily: "var(--ct-font-sans)" }}>
          Portfolio Performance
        </Text>
        <Text size={200} style={{ color: "var(--ct-text-muted)", display: "block", marginTop: 2, fontFamily: "var(--ct-font-sans)" }}>
          30-day projection based on current holdings
        </Text>
      </div>
      <div className={styles.chartWrapper}>
        {isLoading ? (
          <div className={styles.centerState}>
            <Spinner label="Aggregating market data..." />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.08)"
                fontSize={10}
                fontFamily="var(--ct-font-mono)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.08)"
                fontSize={10}
                fontFamily="var(--ct-font-mono)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
                domain={["auto", "auto"]}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#colorPortfolio)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.centerState}>
            <Text style={{ color: "var(--ct-text-muted)" }}>No data available. Add funds to your wallet.</Text>
          </div>
        )}
      </div>
    </Card>
  );
};
