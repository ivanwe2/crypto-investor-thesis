import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, Text, tokens, Spinner, makeStyles } from "@fluentui/react-components";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { marketService } from "../../../market/services/marketService";

const useStyles = makeStyles({
  card: {
    height: "400px",
    backgroundColor: tokens.colorNeutralBackground1Hover,
  },
  chartWrapper: {
    width: "100%",
    height: "300px",
    marginTop: "16px",
  },
  centerState: {
    display: "flex",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  }
});

export const PortfolioChart = ({ assets, totalValue }: { assets: any[], totalValue: number }) => {
  const styles = useStyles();
  const [rawKlines, setRawKlines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Create a simple string key of what's in the wallet (e.g., "BTC,ETH"). 
  // We use THIS to trigger the API call, ignoring price fluctuations.
  const walletCompositionKey = useMemo(() => {
    return assets
      .filter(a => a.currency !== 'USDT' && a.currency !== 'USD')
      .map(a => a.currency)
      .sort()
      .join(',');
  }, [assets]); // We only map the symbols here.

  // 2. Fetch Historical Data ONLY when the wallet composition (the coins you own) changes
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
  }, [walletCompositionKey]); // <--- THIS PREVENTS THE INFINITE LOOP!

  // 3. Compute final chart math instantly in RAM every time SignalR updates the price
  const chartData = useMemo(() => {
    if (assets.length === 0 || totalValue === 0) return [];

    const stableCoins = assets.filter(a => a.currency === 'USDT' || a.currency === 'USD');
    const stableValue = stableCoins.reduce((sum, a) => sum + a.amount, 0);

    // Fallback: If no klines loaded yet, just draw a flat line of current value
    if (rawKlines.length === 0) {
        const flatData = [];
        const now = new Date();
        for(let i=30; i>=0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            flatData.push({ date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: stableValue });
        }
        flatData[flatData.length - 1].value = totalValue;
        return flatData;
    }

    // Aggregate Historical Klines * Current Holdings
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

    // ✨ Overwrite the final day's dot with the absolute latest real-time SignalR value!
    if (aggregated.length > 0) {
       aggregated[aggregated.length - 1].value = totalValue;
    }

    return aggregated;
  }, [rawKlines, assets, totalValue]); // Updates smoothly in memory on every SignalR tick

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Text weight="semibold" size={500}>Current Holdings (30-Day Projection)</Text>}
        description={
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Historical market performance of your current asset allocation.
          </Text>
        }
      />
      <div className={styles.chartWrapper}>
        {isLoading ? (
           <div className={styles.centerState}>
             <Spinner label="Aggregating market data..." />
           </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tokens.colorBrandBackground} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={tokens.colorBrandBackground} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke={tokens.colorNeutralStroke1} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={tokens.colorNeutralStroke1} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toLocaleString()}`} domain={["auto", "auto"]} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tokens.colorNeutralStroke2} />
              <Tooltip
                contentStyle={{ backgroundColor: tokens.colorNeutralBackground1, borderColor: tokens.colorNeutralStroke1, borderRadius: "8px" }}
                itemStyle={{ color: tokens.colorNeutralForeground1 }}
                formatter={(value: any) => [`$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Value"]}
              />
              <Area type="monotone" dataKey="value" stroke={tokens.colorBrandBackground} fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.centerState}>
            <Text>No data available. Add funds to your wallet.</Text>
          </div>
        )}
      </div>
    </Card>
  );
};