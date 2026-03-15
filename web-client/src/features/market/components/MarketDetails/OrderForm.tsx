import { useState, useEffect } from "react";
import {
  Button,
  Card,
  CardHeader,
  Input,
  Radio,
  RadioGroup,
  Spinner,
  tokens,
  Text,
  TabList,
  Tab,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import { orderService } from "../../../trading/services/orderService";
import { useNotificationStore } from "../../../../shared/store/notificationStore";

const useStyles = makeStyles({
  card: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
  },
  formBody: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  infoBox: {
    ...shorthands.padding("12px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius("8px"),
    textAlign: "center",
  },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  clickableText: {
    color: tokens.colorBrandForeground1,
    cursor: "pointer",
    ":hover": {
      textDecorationLine: "underline",
    },
  },
});

export const OrderForm = ({
  symbol,
  currentPrice,
}: {
  symbol: string;
  currentPrice: number;
}) => {
  const styles = useStyles();
  const [orderType, setOrderType] = useState<"Limit" | "Market">("Limit");
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [quantity, setQuantity] = useState("1");
  const [targetPrice, setTargetPrice] = useState(
    currentPrice?.toString() || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✨ Global Toast Store!
  const { addNotification } = useNotificationStore();

  // Keep target price synced with current price initially
  useEffect(() => {
    if (currentPrice && targetPrice === "" && orderType === "Limit") {
      setTargetPrice(currentPrice.toString());
    }
  }, [currentPrice, targetPrice, orderType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const qty = Number(quantity);
    const price = Number(targetPrice);
    const typeEnum = orderType === "Market" ? 1 : 2;
    const sideEnum = side === "Buy" ? 1 : 2;

    // Pre-flight Validation
    if (qty <= 0) {
      addNotification("Quantity must be greater than 0", "error");
      return;
    }
    if (typeEnum === 2 && price <= 0) {
      addNotification("Limit Price must be greater than 0", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      await orderService.placeOrder({
        symbol,
        side: sideEnum,
        type: typeEnum,
        quantity: qty,
        // Send undefined for market orders, just like the old TradePanel
        targetPrice: typeEnum === 2 ? price : undefined,
      });

      const priceText = typeEnum === 1 ? "Market Price" : `@ $${price}`;
      addNotification(
        `${orderType} order submitted: ${side} ${qty} ${symbol} ${priceText}`,
        "info",
      );
    } catch (error: any) {
      console.error("Order failed", error);
      addNotification(
        error.response?.data?.message ||
          error.response?.data ||
          "Failed to place order.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBuy = side === "Buy";
  const effectivePrice =
    orderType === "Limit" ? Number(targetPrice) : currentPrice;
  const estimatedTotal = (Number(quantity) || 0) * (effectivePrice || 0);

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <Text weight="semibold" size={500}>
            Place Order
          </Text>
        }
      />

      <TabList
        selectedValue={orderType}
        onTabSelect={(_, data) =>
          setOrderType(data.value as "Limit" | "Market")
        }
        style={{ marginBottom: "8px" }}
      >
        <Tab value="Limit">Limit</Tab>
        <Tab value="Market">Market</Tab>
      </TabList>

      <form onSubmit={handleSubmit} className={styles.formBody}>
        <RadioGroup
          value={side}
          onChange={(_, d) => setSide(d.value as "Buy" | "Sell")}
          layout="horizontal"
        >
          <Radio
            value="Buy"
            label={
              <Text
                style={{
                  color: tokens.colorPaletteGreenForeground1,
                  fontWeight: side === "Buy" ? "bold" : "normal",
                }}
              >
                Buy
              </Text>
            }
          />
          <Radio
            value="Sell"
            label={
              <Text
                style={{
                  color: tokens.colorPaletteRedForeground1,
                  fontWeight: side === "Sell" ? "bold" : "normal",
                }}
              >
                Sell
              </Text>
            }
          />
        </RadioGroup>

        {orderType === "Limit" && (
          <div>
            <div className={styles.priceRow}>
              <Text
                size={200}
                style={{ color: tokens.colorNeutralForeground3 }}
              >
                Limit Price (USD)
              </Text>
              <Text
                size={200}
                className={styles.clickableText}
                onClick={() => setTargetPrice(currentPrice.toString())}
                title="Click to copy current price"
              >
                Use Last: ${currentPrice?.toLocaleString() || "0.00"}
              </Text>
            </div>
            <Input
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(_, data) => setTargetPrice(data.value)}
              style={{ width: "100%" }}
              required={orderType === "Limit"}
            />
          </div>
        )}

        {orderType === "Market" && (
          <div className={styles.infoBox}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Executes immediately at the best available market price.
            </Text>
          </div>
        )}

        <div>
          <div className={styles.priceRow}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Quantity ({symbol.replace("USDT", "").replace("USD", "")})
            </Text>
          </div>
          <Input
            type="number"
            step="0.0001"
            value={quantity}
            onChange={(_, data) => setQuantity(data.value)}
            style={{ width: "100%" }}
            required
          />
        </div>

        <div className={styles.infoBox}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {orderType === "Market"
              ? "Estimated Total Value"
              : "Total Order Value"}
          </Text>
          <br />
          <Text weight="bold" size={400}>
            $
            {estimatedTotal.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          style={{
            backgroundColor: isBuy
              ? tokens.colorPaletteGreenBackground3
              : tokens.colorPaletteRedBackground3,
            color: "white",
            height: "44px",
            fontSize: "16px",
            fontWeight: "bold",
            transition: "all 0.2s ease",
          }}
        >
          {isSubmitting ? <Spinner size="tiny" /> : `${side} ${symbol}`}
        </Button>
      </form>
    </Card>
  );
};
