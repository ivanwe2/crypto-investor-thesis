import { useMemo } from "react";
import {
  Card,
  Text,
  Button,
  Spinner,
  tokens,
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
    ...shorthands.padding("24px"),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("24px"),
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
  },
  headerSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  valueContainer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
    marginTop: "4px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    ...shorthands.gap("24px"),
    alignItems: "start",
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
    },
  },
  assetList: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  assetCard: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
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
    width: "40px",
    height: "40px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorBrandBackground2,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  assetValues: {
    textAlign: "right",
  },
  loadingWrapper: {
    ...shorthands.padding("2rem"),
    display: "flex",
    justifyContent: "center",
  }
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
      <div className={styles.loadingWrapper}>
        <Spinner size="large" label="Loading Redis Read Model..." />
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      {/* HEADER SECTION */}
      <div className={styles.headerSection}>
        <div>
          <Text size={500} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>
            Total Portfolio Value
          </Text>
          <div className={styles.valueContainer}>
            <Text size={1000} weight="bold">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {isFetching && <Spinner size="tiny" title="Fetching from Redis (~1ms)" />}
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

      <div className={styles.grid}>
        {/* LEFT COLUMN: CHART - Now passing assets! */}
        <PortfolioChart assets={assets} totalValue={totalValue} />

        {/* RIGHT COLUMN: ASSET BREAKDOWN */}
        <div className={styles.assetList}>
          <Text size={500} weight="semibold">Asset Breakdown</Text>

          {assets.length === 0 && (
            <Card>
              <Text>Your wallet is currently empty.</Text>
            </Card>
          )}

          {assets.map((asset) => (
            <Card key={asset.currency} className={styles.assetCard}>
              <div className={styles.assetRow}>
                <div className={styles.assetInfo}>
                  <div className={styles.iconWrapper}>
                    <Wallet24Regular color={tokens.colorBrandForeground2} />
                  </div>
                  <div>
                    <Text weight="bold" size={400}>{asset.currency}</Text>
                    <br />
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      {asset.currency !== "USDT" && asset.currentPrice > 0
                        ? `$${asset.currentPrice.toLocaleString()} per coin`
                        : "Stablecoin"}
                    </Text>
                  </div>
                </div>

                <div className={styles.assetValues}>
                  <Text weight="semibold" size={400}>
                    ${asset.valueInUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <br />
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {asset.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset.currency}
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