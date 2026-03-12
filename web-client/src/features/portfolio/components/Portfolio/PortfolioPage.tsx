import { useMemo } from "react";
import {
  Card,
  Text,
  Button,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowClockwise16Regular,
  Wallet24Regular,
} from "@fluentui/react-icons";
import { usePortfolioQuery } from "../../hooks/usePorfolioQuery";
import { useMarketStore } from "../../../market/store/marketStore";
import { PortfolioChart } from "./PortfolioChart";

export const PortfolioPage = () => {
  const { data: wallet, isLoading, isFetching, refetch } = usePortfolioQuery();
  const tickers = useMarketStore((state) => state.tickers);

  const { assets, totalValue } = useMemo(() => {
    if (!wallet || !wallet.balances) return { assets: [], totalValue: 0 };

    const enrichedAssets = wallet.balances
      .map((b) => {
        const isQuote = b.currency === "USDT" || b.currency === "USD";
        const currentPrice = isQuote
          ? 1
          : tickers[`${b.currency}USDT`]?.price || 0;
        const valueInUsd = b.amount * currentPrice;

        return { ...b, currentPrice, valueInUsd };
      })
      .sort((a, b) => b.valueInUsd - a.valueInUsd);

    const total = enrichedAssets.reduce(
      (sum, asset) => sum + asset.valueInUsd,
      0,
    );

    return { assets: enrichedAssets, totalValue: total };
  }, [wallet, tickers]);

  if (isLoading) {
    return (
      <div
        style={{ padding: "2rem", display: "flex", justifyContent: "center" }}
      >
        <Spinner size="large" label="Loading Redis Read Model..." />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {/* HEADER SECTION */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <Text
            size={500}
            weight="semibold"
            style={{ color: tokens.colorNeutralForeground3 }}
          >
            Total Portfolio Value
          </Text>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "4px",
            }}
          >
            <Text size={1000} weight="bold">
              $
              {totalValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            {isFetching && (
              <Spinner size="tiny" title="Fetching from Redis (~1ms)" />
            )}
          </div>
        </div>

        <Button
          icon={<ArrowClockwise16Regular />}
          appearance="secondary"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Force Sync
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN: CHART */}
        <PortfolioChart currentValue={totalValue} />

        {/* RIGHT COLUMN: ASSET BREAKDOWN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Text size={500} weight="semibold">
            Asset Breakdown
          </Text>

          {assets.length === 0 && (
            <Card>
              <Text>Your wallet is currently empty.</Text>
            </Card>
          )}

          {assets.map((asset) => (
            <Card
              key={asset.currency}
              style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      backgroundColor: tokens.colorBrandBackground2,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Wallet24Regular color={tokens.colorBrandForeground2} />
                  </div>
                  <div>
                    <Text weight="bold" size={400}>
                      {asset.currency}
                    </Text>
                    <br />
                    <Text
                      size={200}
                      style={{ color: tokens.colorNeutralForeground3 }}
                    >
                      {asset.currency !== "USDT" && asset.currentPrice > 0
                        ? `$${asset.currentPrice.toLocaleString()} per coin`
                        : "Stablecoin"}
                    </Text>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <Text weight="semibold" size={400}>
                    $
                    {asset.valueInUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  <br />
                  <Text
                    size={200}
                    style={{ color: tokens.colorNeutralForeground3 }}
                  >
                    {asset.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    {asset.currency}
                  </Text>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
