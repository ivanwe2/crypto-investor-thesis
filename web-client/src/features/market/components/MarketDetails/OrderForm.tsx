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
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [quantity, setQuantity] = useState("1");
  const [targetPrice, setTargetPrice] = useState(
    currentPrice?.toString() || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentPrice && !targetPrice) setTargetPrice(currentPrice.toString());
  }, [currentPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await orderService.placeOrder({
        symbol,
        side: 1,
        type: 2,
        quantity: parseFloat(quantity),
        targetPrice: parseFloat(targetPrice),
      });
      alert(
        `Limit ${side} order placed for ${quantity} ${symbol} @ $${targetPrice}`,
      );
    } catch (error) {
      console.error("Order failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBuy = side === "Buy";

  return (
    <Card style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}>
      <CardHeader
        header={
          <Text weight="semibold" size={500}>
            Place Limit Order
          </Text>
        }
      />

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          marginTop: "12px",
        }}
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

        <div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Price (USD)
          </Text>
          <Input
            type="number"
            step="0.01"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            style={{ width: "100%" }}
            required
          />
        </div>

        <div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Quantity ({symbol.replace("USDT", "")})
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
            Total Order Value
          </Text>
          <br />
          <Text weight="bold" size={400}>
            $
            {(
              (parseFloat(quantity) || 0) * (parseFloat(targetPrice) || 0)
            ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
          }}
        >
          {isSubmitting ? <Spinner size="tiny" /> : `${side} ${symbol}`}
        </Button>
      </form>
    </Card>
  );
};
