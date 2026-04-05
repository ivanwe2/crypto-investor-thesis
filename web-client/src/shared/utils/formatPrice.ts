/**
 * Formats a crypto price with the right number of decimal places
 * for its magnitude — handles everything from BTC (~$60k) down to
 * PEPE/SHIB territory (0.000001x).
 */
export const formatPrice = (price: number): string => {
  if (price === 0) return "0.00";

  if (price >= 10_000)
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  if (price >= 1_000)
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (price >= 1)
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });

  if (price >= 0.01)
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });

  if (price >= 0.0001)
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 8,
    });

  const fixed = price.toFixed(12);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed;
};