import { useState } from "react";
import { Text, makeStyles, shorthands, Spinner } from "@fluentui/react-components";
import { marketService } from "../../services/marketService";
import { useWatchlistStore } from "../../store/watchlistStore";
import { signalRService } from "../../../../shared/services/signalRService";

const POPULAR_COINS: { symbol: string; label: string; category: string }[] = [
  // Large cap
  { symbol: "BNBUSDT",   label: "BNB",   category: "Large Cap" },
  { symbol: "XRPUSDT",   label: "XRP",   category: "Large Cap" },
  { symbol: "ADAUSDT",   label: "ADA",   category: "Large Cap" },
  { symbol: "DOGEUSDT",  label: "DOGE",  category: "Large Cap" },
  { symbol: "TRXUSDT",   label: "TRX",   category: "Large Cap" },
  { symbol: "LTCUSDT",   label: "LTC",   category: "Large Cap" },
  { symbol: "XLMUSDT",   label: "XLM",   category: "Large Cap" },
  { symbol: "SHIBUSDT",  label: "SHIB",  category: "Large Cap" },
  // Alt L1
  { symbol: "AVAXUSDT",  label: "AVAX",  category: "Alt L1" },
  { symbol: "DOTUSDT",   label: "DOT",   category: "Alt L1" },
  { symbol: "ATOMUSDT",  label: "ATOM",  category: "Alt L1" },
  { symbol: "NEARUSDT",  label: "NEAR",  category: "Alt L1" },
  { symbol: "APTUSDT",   label: "APT",   category: "Alt L1" },
  { symbol: "SUIUSDT",   label: "SUI",   category: "Alt L1" },
  { symbol: "INJUSDT",   label: "INJ",   category: "Alt L1" },
  { symbol: "FTMUSDT",   label: "FTM",   category: "Alt L1" },
  // DeFi / L2
  { symbol: "LINKUSDT",  label: "LINK",  category: "DeFi / L2" },
  { symbol: "UNIUSDT",   label: "UNI",   category: "DeFi / L2" },
  { symbol: "ARBUSDT",   label: "ARB",   category: "DeFi / L2" },
  { symbol: "OPUSDT",    label: "OP",    category: "DeFi / L2" },
  { symbol: "MATICUSDT", label: "MATIC", category: "DeFi / L2" },
  { symbol: "AAVEUSDT",  label: "AAVE",  category: "DeFi / L2" },
  // Meme / Other
  { symbol: "PEPEUSDT",  label: "PEPE",  category: "Meme" },
  { symbol: "WLDUSDT",   label: "WLD",   category: "Meme" },
  { symbol: "SANDUSDT",  label: "SAND",  category: "Meme" },
  { symbol: "AXSUSDT",   label: "AXS",   category: "Meme" },
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; hoverBg: string }> = {
  "Large Cap":   { bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.25)",  text: "#60A5FA",  hoverBg: "rgba(59,130,246,0.16)" },
  "Alt L1":      { bg: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.25)",  text: "#C084FC",  hoverBg: "rgba(168,85,247,0.16)" },
  "DeFi / L2":   { bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)",  text: "#34D399",  hoverBg: "rgba(16,185,129,0.16)" },
  "Meme":        { bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)",  text: "#FBBF24",  hoverBg: "rgba(251,191,36,0.16)" },
};

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
    ...shorthands.padding("14px", "0", "0", "0"),
    ...shorthands.borderTop("1px", "solid", "var(--ct-border)"),
    marginTop: "8px",
  },
  sectionLabel: {
    fontSize: "10px",
    fontFamily: "var(--ct-font-mono)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--ct-text-muted)",
  },
  categoryRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    ...shorthands.gap("5px"),
  },
  categoryLabel: {
    fontSize: "10px",
    fontFamily: "var(--ct-font-mono)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--ct-text-muted)",
    minWidth: "60px",
    paddingRight: "4px",
    fontWeight: "500",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    ...shorthands.gap("3px"),
    ...shorthands.padding("3px", "9px"),
    ...shorthands.borderRadius("var(--ct-radius-sm)"),
    ...shorthands.border("1px", "solid", "transparent"),
    fontSize: "11.5px",
    fontFamily: "var(--ct-font-mono)",
    fontWeight: "600",
    letterSpacing: "0.03em",
    cursor: "pointer",
    userSelect: "none",
    transitionProperty: "background-color, border-color, transform, opacity",
    transitionDuration: "0.15s",
    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    lineHeight: "1.6",
    ":active": { transform: "scale(0.95)" },
  },
  addedChip: {
    opacity: "0.3",
    cursor: "default",
    ":active": { transform: "none" },
  },
});

export const PopularMarkets = () => {
  const styles = useStyles();
  const { symbols: watchList, addSymbol } = useWatchlistStore();
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const categories = Array.from(new Set(POPULAR_COINS.map((c) => c.category)));

  const handleClick = async (symbol: string) => {
    if (watchList.includes(symbol) || loading.has(symbol)) return;

    setLoading((prev) => new Set(prev).add(symbol));
    try {
      await marketService.trackMarket(symbol);
    } catch (err) {
      console.warn(`[PopularMarkets] trackMarket failed for ${symbol}`, err);
    }
    addSymbol(symbol);
    await signalRService.joinGroup(symbol);
    setLoading((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
  };

  return (
    <div className={styles.root}>
      <Text className={styles.sectionLabel}>
        Quick-add popular markets
      </Text>

      {categories.map((cat) => {
        const coins = POPULAR_COINS.filter((c) => c.category === cat);
        const colors = CATEGORY_COLORS[cat];

        return (
          <div key={cat} className={styles.categoryRow}>
            <span className={styles.categoryLabel}>{cat}</span>
            {coins.map(({ symbol, label }) => {
              const isAdded = watchList.includes(symbol);
              const isLoading = loading.has(symbol);

              return (
                <span
                  key={symbol}
                  className={`${styles.chip}${isAdded ? ` ${styles.addedChip}` : ""}`}
                  style={{
                    backgroundColor: isAdded ? "transparent" : colors.bg,
                    borderColor: isAdded ? "var(--ct-border)" : colors.border,
                    color: isAdded ? "var(--ct-text-muted)" : colors.text,
                  }}
                  onClick={() => handleClick(symbol)}
                  onMouseEnter={(e) => {
                    if (!isAdded) (e.currentTarget as HTMLElement).style.backgroundColor = colors.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!isAdded) (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg;
                  }}
                  title={isAdded ? `${symbol} already in watchlist` : `Add ${symbol}`}
                >
                  {isLoading ? <Spinner size="extra-tiny" /> : null}
                  {label}
                  {isAdded ? null : <span style={{ opacity: 0.5, fontSize: "9px" }}>+</span>}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
