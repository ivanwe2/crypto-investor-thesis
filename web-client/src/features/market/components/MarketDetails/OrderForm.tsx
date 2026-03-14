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
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { orderService } from "../../../trading/services/orderService";

export const OrderForm = ({
  symbol,
  currentPrice,
}: {
  symbol: string;
  currentPrice: number;
}) => {
  const [orderType, setOrderType] = useState<"Limit" | "Market">("Limit");
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [quantity, setQuantity] = useState("1");
  const [targetPrice, setTargetPrice] = useState(
    currentPrice?.toString() || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep target price somewhat synced with current price if they haven't typed yet
  useEffect(() => {
    if (currentPrice && !targetPrice && orderType === "Limit") {
      setTargetPrice(currentPrice.toString());
    }
  }, [currentPrice, targetPrice, orderType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Map order types: Assuming 1 = Market, 2 = Limit based on standard matching engine conventions
    const typeEnum = orderType === "Market" ? 1 : 2;
    const sideEnum = side === "Buy" ? 1 : 2; // Assuming 1=Buy, 2=Sell

    try {
      await orderService.placeOrder({
        symbol,
        side: sideEnum,
        type: typeEnum,
        quantity: parseFloat(quantity),
        // Send 0 for market orders to indicate take-best-price
        targetPrice: orderType === "Market" ? 0 : parseFloat(targetPrice),
      });

      const priceMsg =
        orderType === "Market" ? "Market Price" : `$${targetPrice}`;
      alert(
        `${orderType} ${side} order placed for ${quantity} ${symbol} @ ${priceMsg}`,
      );
    } catch (error) {
      console.error("Order failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBuy = side === "Buy";

  // Calculate estimated total. For market orders, use current price as an estimate.
  const estimatedTotal =
    (parseFloat(quantity) || 0) *
    (orderType === "Market" ? currentPrice : parseFloat(targetPrice) || 0);

  return (
    <Card style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}>
      <CardHeader
        header={
          <Text weight="semibold" size={500}>
            Place Order
          </Text>
        }
      />

      {/* ORDER TYPE TOGGLE */}
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

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <RadioGroup
          value={side}
          onChange={(_, d) => setSide(d.value as "Buy" | "Sell")}
          layout="horizontal"
        >
          <Radio
            value="Buy"
            label={
              <Text style={{ color: tokens.colorPaletteGreenForeground1 }}>
                Buy
              </Text>
            }
          />
          <Radio
            value="Sell"
            label={
              <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
                Sell
              </Text>
            }
          />
        </RadioGroup>

        {/* PRICE INPUT (Hidden for Market Orders) */}
        {orderType === "Limit" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text
                size={200}
                style={{ color: tokens.colorNeutralForeground3 }}
              >
                Price (USD)
              </Text>
              <Text
                size={200}
                style={{
                  color: tokens.colorNeutralForeground4,
                  cursor: "pointer",
                }}
                onClick={() => setTargetPrice(currentPrice.toString())}
              >
                Use Last: {currentPrice}
              </Text>
            </div>
            <Input
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              style={{ width: "100%" }}
              required={orderType === "Limit"}
            />
          </div>
        )}

        {orderType === "Market" && (
          <div
            style={{
              padding: "8px",
              backgroundColor: tokens.colorNeutralBackground2,
              borderRadius: "4px",
              textAlign: "center",
            }}
          >
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Executes at the best available market price.
            </Text>
          </div>
        )}

        <div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Quantity ({symbol.replace("USDT", "").replace("USD", "")})
          </Text>
          <Input
            type="number"
            step="0.0001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{ width: "100%" }}
            required
          />
        </div>

        <div
          style={{
            padding: "12px",
            backgroundColor: tokens.colorNeutralBackground2,
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {orderType === "Market" ? "Estimated Total" : "Total Order Value"}
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
            height: "40px",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          {isSubmitting ? <Spinner size="tiny" /> : `${side} ${symbol}`}
        </Button>
      </form>
    </Card>
  );
};
