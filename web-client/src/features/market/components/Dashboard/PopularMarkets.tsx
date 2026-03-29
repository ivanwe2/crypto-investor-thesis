import { useState } from "react";
import { Text, tokens, makeStyles, shorthands, Spinner } from "@fluentui/react-components";
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
  "Large Cap":   { bg: "rgba(0,120,212,0.08)",  border: "rgba(0,120,212,0.35)",  text: tokens.colorPaletteBlueForeground2,       hoverBg: "rgba(0,120,212,0.18)"  },
  "Alt L1":      { bg: "rgba(134,93,250,0.08)", border: "rgba(134,93,250,0.35)", text: tokens.colorPalettePurpleForeground2,     hoverBg: "rgba(134,93,250,0.18)" },
  "DeFi / L2":   { bg: "rgba(0,183,195,0.08)",  border: "rgba(0,183,195,0.35)",  text: tokens.colorPaletteTealForeground2,       hoverBg: "rgba(0,183,195,0.18)"  },
  "Meme":        { bg: "rgba(255,170,0,0.08)",   border: "rgba(255,170,0,0.35)",   text: tokens.colorPaletteDarkOrangeForeground2, hoverBg: "rgba(255,170,0,0.18)"   },
};

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("10px"),
    ...shorthands.padding("12px", "0", "0", "0"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
    marginTop: "4px",
  },
  categoryRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    ...shorthands.gap("6px"),
  },
  categoryLabel: {
    fontSize: "10px",
    fontFamily: "monospace",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: tokens.colorNeutralForeground4,
    minWidth: "64px",
    paddingRight: "4px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    ...shorthands.gap("4px"),
    ...shorthands.padding("3px", "10px"),
    ...shorthands.borderRadius("4px"),
    ...shorthands.border("1px", "solid", "transparent"),
    fontSize: "12px",
    fontFamily: "monospace",
    fontWeight: "600",
    letterSpacing: "0.04em",
    cursor: "pointer",
    userSelect: "none",
    transitionProperty: "background-color, border-color, transform, opacity",
    transitionDuration: "0.15s",
    transitionTimingFunction: "ease",
    lineHeight: "1.6",
    ":active": { transform: "scale(0.95)" },
  },
  addedChip: {
    opacity: "0.35",
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
      <Text size={100} style={{ color: tokens.colorNeutralForeground4, fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>
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
                    borderColor: isAdded ? tokens.colorNeutralStroke1 : colors.border,
                    color: isAdded ? tokens.colorNeutralForeground4 : colors.text,
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
                  {isAdded ? null : <span style={{ opacity: 0.6, fontSize: "10px" }}>+</span>}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};