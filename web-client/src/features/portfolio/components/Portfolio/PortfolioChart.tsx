import { Card, CardHeader, Text, tokens } from "@fluentui/react-components";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useMemo } from "react";

export const PortfolioChart = ({ currentValue }: { currentValue: number }) => {
  const generateHistoricalData = (currentValue: number) => {
    if (currentValue === 0) return [];

    const data = [];
    let val = currentValue * 0.85;
    const now = new Date();

    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      if (i === 0) {
        val = currentValue;
      } else {
        val += (Math.random() - 0.45) * (currentValue * 0.04);
      }

      data.push({
        date: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        value: val,
      });
    }
    return data;
  };

  const data = useMemo(
    () => generateHistoricalData(currentValue),
    [currentValue],
  );

  return (
    <Card
      style={{
        height: 400,
        backgroundColor: tokens.colorNeutralBackground1Hover,
      }}
    >
      <CardHeader
        header={
          <Text weight="semibold" size={500}>
            30-Day Performance
          </Text>
        }
        description={
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Historical data is mocked based on current asset value.
          </Text>
        }
      />
      <div style={{ width: "100%", height: 300, marginTop: "16px" }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={tokens.colorBrandBackground}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={tokens.colorBrandBackground}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke={tokens.colorNeutralStroke1}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={tokens.colorNeutralStroke1}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
                domain={["auto", "auto"]}
              />
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={tokens.colorNeutralStroke2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tokens.colorNeutralBackground1,
                  borderColor: tokens.colorNeutralStroke1,
                  borderRadius: "8px",
                }}
                itemStyle={{ color: tokens.colorNeutralForeground1 }}
                formatter={(value) => [
                  `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  "Value",
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={tokens.colorBrandBackground}
                fillOpacity={1}
                fill="url(#colorValue)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              display: "flex",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text>No data available. Add funds to your wallet.</Text>
          </div>
        )}
      </div>
    </Card>
  );
};
