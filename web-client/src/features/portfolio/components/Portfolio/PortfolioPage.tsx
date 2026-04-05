import { useMemo } from "react";
import {
  Card,
  Text,
  Badge,
  Button,
  Spinner,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import {
  ArrowClockwise16Regular,
  Wallet24Regular,
} from "@fluentui/react-icons";
import { usePortfolioQuery } from "../../hooks/usePorfolioQuery";
import { useMarketStore } from "../../../market/store/marketStore";
import { PortfolioChart } from "./PortfolioChart";

const useStyles = makeStyles({
  pageWrapper: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("24px"),
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    animation: "ct-fade-in 0.35s ease-out both",
  },
  headerSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLabel: {
    fontFamily: "var(--ct-font-sans)",
    color: "var(--ct-text-muted)",
    fontSize: "13px",
    fontWeight: "500",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  totalValue: {
    fontFamily: "var(--ct-font-mono)",
    letterSpacing: "-0.03em",
    marginTop: "4px",
  },
  valueContainer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    ...shorthands.gap("20px"),
    alignItems: "start",
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
    },
  },
  assetList: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
  },
  sectionTitle: {
    fontFamily: "var(--ct-font-sans)",
    letterSpacing: "-0.01em",
    marginBottom: "4px",
  },
  assetCard: {
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-md)"),
    ...shorthands.padding("14px", "16px"),
    transitionProperty: "border-color, box-shadow",
    transitionDuration: "0.2s",
    ":hover": {
      ...shorthands.borderColor("var(--ct-border-hover)"),
    },
  },
  assetRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assetInfo: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
  },
  iconWrapper: {
    width: "36px",
    height: "36px",
    ...shorthands.borderRadius("50%"),
    background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
    ...shorthands.border("1px", "solid", "var(--ct-border-brand)"),
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  assetValues: {
    textAlign: "right",
  },
  pnlRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    ...shorthands.gap("6px"),
    marginTop: "4px",
  },
  loadingWrapper: {
    ...shorthands.padding("3rem"),
    display: "flex",
    justifyContent: "center",
  },
  emptyState: {
    ...shorthands.padding("40px"),
    textAlign: "center",
    color: "var(--ct-text-muted)",
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "dashed", "var(--ct-border-hover)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
  },
});

export const PortfolioPage = () => {
  const styles = useStyles();
  const { data: wallet, isLoading, isFetching, refetch } = usePortfolioQuery();
  const tickers = useMarketStore((state) => state.tickers);

  const { assets, totalValue } = useMemo(() => {
    if (!wallet || !wallet.balances) return { assets: [], totalValue: 0 };

    const enrichedAssets = wallet.balances
      .map((b) => {
        const isQuote = b.currency === "USDT" || b.currency === "USD";
        const realtimePrice = tickers[`${b.currency}USDT`]?.price;
        const currentPrice = isQuote ? 1 : (realtimePrice || b.currentPrice || 0);
        const valueInUsd = b.amount * currentPrice;
        const entryPrice = isQuote ? null : b.averageEntryPrice;
        const pnlPercent = entryPrice && entryPrice > 0
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : null;

        return { ...b, currentPrice, valueInUsd, entryPrice, pnlPercent };
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
      <div className={styles.loadingWrapper}>
        <Spinner size="large" label="Loading portfolio..." />
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      {/* HEADER */}
      <div className={styles.headerSection}>
        <div>
          <Text className={styles.headerLabel}>
            Total Portfolio Value
          </Text>
          <div className={styles.valueContainer}>
            <Text size={1000} weight="bold" className={styles.totalValue}>
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {isFetching && <Spinner size="tiny" />}
          </div>
        </div>

        <Button
          icon={<ArrowClockwise16Regular />}
          appearance="secondary"
          size="small"
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ borderRadius: "var(--ct-radius-sm)" }}
        >
          Sync
        </Button>
      </div>

      <div className={styles.grid}>
        {/* CHART */}
        <PortfolioChart assets={assets} totalValue={totalValue} />

        {/* ASSET BREAKDOWN */}
        <div className={styles.assetList}>
          <Text size={400} weight="semibold" className={styles.sectionTitle}>
            Holdings
          </Text>

          {assets.length === 0 && (
            <div className={styles.emptyState}>
              <Text>Your wallet is empty. Start trading to build your portfolio.</Text>
            </div>
          )}

          {assets.map((asset, idx) => (
            <Card
              key={asset.currency}
              className={styles.assetCard}
              style={{ animation: `ct-fade-in 0.3s ease-out ${idx * 40}ms both` }}
            >
              <div className={styles.assetRow}>
                <div className={styles.assetInfo}>
                  <div className={styles.iconWrapper}>
                    <Wallet24Regular style={{ color: "var(--ct-brand)", fontSize: 18 }} />
                  </div>
                  <div>
                    <Text weight="bold" size={400} style={{ fontFamily: "var(--ct-font-sans)" }}>
                      {asset.currency}
                    </Text>
                    <br />
                    <Text size={200} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-mono)" }}>
                      {asset.currency !== "USDT" && asset.currentPrice > 0
                        ? `$${asset.currentPrice.toLocaleString()} / coin`
                        : "Stablecoin"}
                    </Text>
                  </div>
                </div>

                <div className={styles.assetValues}>
                  <Text weight="semibold" size={400} style={{ fontFamily: "var(--ct-font-mono)" }}>
                    ${asset.valueInUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <br />
                  <Text size={200} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-mono)" }}>
                    {asset.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset.currency}
                  </Text>
                  {asset.pnlPercent !== null && (
                    <div className={styles.pnlRow}>
                      <Text size={100} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-mono)" }}>
                        Entry ${asset.entryPrice!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <Badge
                        size="small"
                        appearance="filled"
                        color={asset.pnlPercent >= 0 ? "success" : "danger"}
                        style={{
                          fontFamily: "var(--ct-font-mono)",
                          fontSize: "11px",
                          boxShadow: asset.pnlPercent >= 0 ? "var(--ct-glow-bullish)" : "var(--ct-glow-bearish)",
                        }}
                      >
                        {asset.pnlPercent >= 0 ? "+" : ""}{asset.pnlPercent.toFixed(2)}%
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
