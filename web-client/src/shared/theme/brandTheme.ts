import {
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from "@fluentui/react-components";

/**
 * Emerald brand ramp — generated from #10B981.
 * 16-step gradient from near-black to near-white through emerald.
 */
const emeraldBrand: BrandVariants = {
  10: "#030F0A",
  20: "#061F15",
  30: "#0A3324",
  40: "#0D4733",
  50: "#0F5C42",
  60: "#107050",
  70: "#10B981",   // Primary brand
  80: "#34D399",
  90: "#5EDBA8",
  100: "#7DE3B8",
  110: "#9BEBC8",
  120: "#B5F2D8",
  130: "#CFF8E7",
  140: "#E5FBF1",
  150: "#F0FDF7",
  160: "#F8FEFC",
};

export const emeraldDarkTheme: Theme = {
  ...createDarkTheme(emeraldBrand),
  // Override key surface tokens for the Midnight Emerald aesthetic
  colorNeutralBackground1: "#0B1120",
  colorNeutralBackground1Hover: "#111827",
  colorNeutralBackground1Pressed: "#0F172A",
  colorNeutralBackground2: "#1A2332",
  colorNeutralBackground3: "#1E293B",
  colorNeutralBackground4: "#243244",
  colorNeutralForeground1: "#F1F5F9",
  colorNeutralForeground2: "#E2E8F0",
  colorNeutralForeground3: "#94A3B8",
  colorNeutralForeground4: "#64748B",
  colorNeutralStroke1: "rgba(255, 255, 255, 0.08)",
  colorNeutralStroke2: "rgba(255, 255, 255, 0.05)",
  colorSubtleBackground: "transparent",
  colorSubtleBackgroundHover: "rgba(255, 255, 255, 0.04)",
  colorSubtleBackgroundPressed: "rgba(255, 255, 255, 0.02)",
};

export const emeraldLightTheme: Theme = {
  ...createLightTheme(emeraldBrand),
  colorNeutralBackground1: "#FFFFFF",
  colorNeutralBackground1Hover: "#F8FAFC",
  colorNeutralBackground2: "#F1F5F9",
  colorNeutralBackground3: "#E2E8F0",
  colorNeutralForeground1: "#0F172A",
  colorNeutralForeground2: "#1E293B",
  colorNeutralForeground3: "#475569",
  colorNeutralForeground4: "#94A3B8",
  colorNeutralStroke1: "rgba(0, 0, 0, 0.08)",
  colorNeutralStroke2: "rgba(0, 0, 0, 0.05)",
};
