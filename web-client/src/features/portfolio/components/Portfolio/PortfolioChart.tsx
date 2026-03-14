import { useEffect, useState } from "react";
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

// We accept the enriched assets array from the PortfolioPage
export const PortfolioChart = ({ assets, totalValue }: { assets: any[], totalValue: number }) => {
  const styles = useStyles();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const buildHistoricalData = async () => {
      if (!assets || assets.length === 0 || totalValue === 0) {
        setData([]);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Separate Stablecoins (flat value) from Volatile Crypto
        const stableCoins = assets.filter(a => a.currency === 'USDT' || a.currency === 'USD');
        const stableValue = stableCoins.reduce((sum, a) => sum + a.amount, 0);
        const volatileAssets = assets.filter(a => a.currency !== 'USDT' && a.currency !== 'USD');

        // If user only holds USDT, just draw a flat line
        if (volatileAssets.length === 0) {
          const flatData = [];
          const now = new Date();
          for(let i=30; i>=0; i--) {
              const d = new Date(now);
              d.setDate(d.getDate() - i);
              flatData.push({ date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: stableValue });
          }
          if (isMounted) setData(flatData);
          return;
        }

        // 2. Fetch 30-day "1d" Klines for all volatile assets concurrently
        const promises = volatileAssets.map(asset =>
          marketService.getHistoricalKlines(`${asset.currency}USDT`, "1d", 30)
            .then(res => ({ currency: asset.currency, amount: asset.amount, klines: res.klines }))
            .catch(err => {
              console.warn(`Failed to fetch klines for ${asset.currency}`, err);
              return null; // Ignore failed pairs safely
            })
        );

        const results = await Promise.all(promises);
        const validResults = results.filter(r => r !== null) as any[];

        if (!isMounted) return;

        // 3. Aggregate the data by day
        if (validResults.length > 0 && validResults[0].klines.length > 0) {
          // Use the first successful asset's timeline as our baseline calendar
          const aggregatedData = validResults[0].klines.map((baseKline: any, index: number) => {
            let dailyTotal = stableValue; // Start with the cash baseline

            // Add the historical value of each volatile asset on this specific day
            validResults.forEach(result => {
              const klineForDay = result.klines[index];
              if (klineForDay) {
                dailyTotal += (result.amount * klineForDay.close); // Amount * Daily Close Price
              }
            });

            return {
              date: new Date(baseKline.startTimeUtc * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
              value: dailyTotal
            };
          });

          // 4. Overwrite the final day with real-time totalValue from SignalR
          if (aggregatedData.length > 0) {
             aggregatedData[aggregatedData.length - 1].value = totalValue;
          }

          setData(aggregatedData);
        }
      } catch (error) {
        console.error("Failed to build portfolio chart:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    buildHistoricalData();
    return () => { isMounted = false; };
  }, [assets, totalValue]); // Re-calculate if wallet composition changes

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
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <Area type="monotone" dataKey="value" stroke={tokens.colorBrandBackground} fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} isAnimationActive={true} />
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