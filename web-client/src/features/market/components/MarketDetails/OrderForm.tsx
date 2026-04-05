import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Button,
  Card,
  Input,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  makeStyles,
  shorthands,
  Field,
} from "@fluentui/react-components";
import { orderService } from "../../../trading/services/orderService";
import { useNotificationStore } from "../../../../shared/store/notificationStore";
import { OrderSide, OrderType } from "../../../trading/dtos/OrderDtos";

const orderSchema = z.object({
  orderType: z.nativeEnum(OrderType),
  side: z.nativeEnum(OrderSide),
  quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Quantity must be greater than 0",
  }),
  targetPrice: z.string().optional(),
  stopPrice: z.string().optional(),
}).refine((data) => {
  if (data.orderType === OrderType.Limit) {
    return !!data.targetPrice && !isNaN(Number(data.targetPrice)) && Number(data.targetPrice) > 0;
  }
  return true;
}, {
  message: "Limit Price must be greater than 0",
  path: ["targetPrice"],
}).refine((data) => {
  if (data.orderType === OrderType.StopLoss || data.orderType === OrderType.TakeProfit) {
    return !!data.stopPrice && !isNaN(Number(data.stopPrice)) && Number(data.stopPrice) > 0;
  }
  return true;
}, {
  message: "Trigger Stop Price must be greater than 0",
  path: ["stopPrice"],
});

type OrderFormValues = z.infer<typeof orderSchema>;

const ORDER_TYPE_OPTIONS = [
  { value: OrderType.Limit,       label: "Limit"       },
  { value: OrderType.Market,      label: "Market"      },
  { value: OrderType.StopLoss,    label: "Stop Loss"   },
  { value: OrderType.TakeProfit,  label: "Take Profit" },
] as const;

const useStyles = makeStyles({
  card: {
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    ...shorthands.padding("16px"),
    animation: "ct-fade-in 0.4s ease-out 0.2s both",
  },
  header: {
    ...shorthands.margin("0", "0", "14px", "0"),
  },
  formBody: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("14px"),
  },
  orderTypeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    ...shorthands.gap("4px"),
    backgroundColor: "var(--ct-bg-elevated)",
    ...shorthands.borderRadius("var(--ct-radius-md)"),
    ...shorthands.padding("3px"),
  },
  orderTypeBtn: {
    width: "100%",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "var(--ct-font-sans)",
    ...shorthands.padding("6px", "4px"),
    ...shorthands.borderRadius("var(--ct-radius-sm)"),
    minWidth: "0",
  },
  infoBox: {
    ...shorthands.padding("10px", "12px"),
    backgroundColor: "var(--ct-bg-elevated)",
    ...shorthands.borderRadius("var(--ct-radius-md)"),
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    textAlign: "center",
  },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  clickableText: {
    color: "var(--ct-brand)",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: "var(--ct-font-mono)",
    ":hover": { textDecorationLine: "underline" },
  },
  submitBtn: {
    height: "42px",
    fontSize: "14px",
    fontWeight: "700",
    fontFamily: "var(--ct-font-sans)",
    letterSpacing: "0.02em",
    ...shorthands.borderRadius("var(--ct-radius-md)"),
    transitionProperty: "all",
    transitionDuration: "0.2s",
  },
});

export const OrderForm = ({ symbol, currentPrice }: { symbol: string; currentPrice: number; }) => {
  const styles = useStyles();
  const { addNotification } = useNotificationStore();

  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      orderType: OrderType.Limit,
      side: OrderSide.Buy,
      quantity: "1",
      targetPrice: currentPrice ? currentPrice.toString() : "",
      stopPrice: "",
    },
    mode: "onTouched",
  });

  const watchOrderType = watch("orderType");
  const watchSide = watch("side");
  const watchQuantity = watch("quantity");
  const watchTargetPrice = watch("targetPrice");

  useEffect(() => {
    if (currentPrice && !watchTargetPrice && watchOrderType === OrderType.Limit) {
      setValue("targetPrice", currentPrice.toString(), { shouldValidate: true });
    }
  }, [currentPrice, watchTargetPrice, watchOrderType, setValue]);

  const onSubmit = async (data: OrderFormValues) => {
    const sideEnum = data.side === OrderSide.Buy ? 1 : 2;
    let typeEnum = 2;
    if (data.orderType === OrderType.Market)     typeEnum = 1;
    if (data.orderType === OrderType.StopLoss)   typeEnum = 3;
    if (data.orderType === OrderType.TakeProfit) typeEnum = 4;

    const parsedQty = Number(data.quantity);
    let finalTargetPrice = data.targetPrice ? Number(data.targetPrice) : undefined;
    let finalStopPrice   = data.stopPrice   ? Number(data.stopPrice)   : undefined;

    if (typeEnum === 1) {
      finalTargetPrice = sideEnum === 1
        ? currentPrice * 1.05
        : currentPrice * 0.95;
    }

    try {
      await orderService.placeOrder({
        symbol,
        side: sideEnum,
        type: typeEnum,
        quantity: parsedQty,
        targetPrice: finalTargetPrice || 0,
        stopPrice: [OrderType.StopLoss, OrderType.TakeProfit].includes(data.orderType as any) ? finalStopPrice : undefined,
      });

      const priceText = typeEnum === 1 ? "Market Price" : `@ $${finalTargetPrice}`;
      addNotification(`${data.orderType} order submitted: ${data.side} ${parsedQty} ${symbol} ${priceText}`, "success");
    } catch (error: any) {
      console.error("Order failed", error);
      addNotification(error.response?.data?.message || error.response?.data || "Failed to place order.", "error");
    }
  };

  const isBuy = watchSide === OrderSide.Buy;
  const effectivePrice = watchOrderType === OrderType.Limit ? (Number(watchTargetPrice) || 0) : currentPrice;
  const estimatedTotal = (Number(watchQuantity) || 0) * (effectivePrice || 0);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Text weight="semibold" size={400} style={{ fontFamily: "var(--ct-font-sans)" }}>
          Place Order
        </Text>
      </div>

      {/* Order Type Selector */}
      <Controller
        name="orderType"
        control={control}
        render={({ field }) => (
          <div className={styles.orderTypeGrid}>
            {ORDER_TYPE_OPTIONS.map(({ value, label }) => {
              const isActive = field.value === value;
              return (
                <Button
                  key={value}
                  className={styles.orderTypeBtn}
                  appearance={isActive ? "primary" : "subtle"}
                  size="small"
                  onClick={() => field.onChange(value)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}
      />

      <form onSubmit={handleSubmit(onSubmit)} className={styles.formBody}>
        <Controller
          name="side"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onChange={(_, d) => field.onChange(d.value as OrderSide)}
              layout="horizontal"
            >
              <Radio
                value={OrderSide.Buy}
                label={
                  <Text style={{
                    color: "var(--ct-bullish)",
                    fontWeight: field.value === OrderSide.Buy ? "bold" : "normal",
                    fontFamily: "var(--ct-font-sans)",
                    fontSize: "13px",
                  }}>
                    Buy
                  </Text>
                }
              />
              <Radio
                value={OrderSide.Sell}
                label={
                  <Text style={{
                    color: "var(--ct-bearish)",
                    fontWeight: field.value === OrderSide.Sell ? "bold" : "normal",
                    fontFamily: "var(--ct-font-sans)",
                    fontSize: "13px",
                  }}>
                    Sell
                  </Text>
                }
              />
            </RadioGroup>
          )}
        />

        {watchOrderType === OrderType.Limit && (
          <Controller
            name="targetPrice"
            control={control}
            render={({ field }) => (
              <Field
                validationMessage={errors.targetPrice?.message}
                validationState={errors.targetPrice ? "error" : "none"}
              >
                <div className={styles.priceRow}>
                  <Text size={200} style={{ color: "var(--ct-text-secondary)", fontFamily: "var(--ct-font-sans)" }}>Limit Price (USD)</Text>
                  <Text
                    size={200}
                    className={styles.clickableText}
                    onClick={() => setValue("targetPrice", currentPrice.toString(), { shouldValidate: true })}
                    title="Click to copy current price"
                  >
                    Use Last: ${currentPrice?.toLocaleString() || "0.00"}
                  </Text>
                </div>
                <Input
                  value={field.value}
                  onChange={(_, data) => field.onChange(data.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  type="number"
                  step="0.01"
                  style={{ width: "100%", fontFamily: "var(--ct-font-mono)" }}
                />
              </Field>
            )}
          />
        )}

        {[OrderType.StopLoss, OrderType.TakeProfit].includes(watchOrderType as any) && (
          <Controller
            name="stopPrice"
            control={control}
            render={({ field }) => (
              <Field
                validationMessage={errors.stopPrice?.message}
                validationState={errors.stopPrice ? "error" : "none"}
              >
                <div className={styles.priceRow}>
                  <Text size={200} style={{ color: "var(--ct-text-secondary)", fontFamily: "var(--ct-font-sans)" }}>Trigger Price (USD)</Text>
                  <Text
                    size={200}
                    className={styles.clickableText}
                    onClick={() => setValue("stopPrice", currentPrice.toString(), { shouldValidate: true })}
                    title="Click to copy current price"
                  >
                    Use Last: ${currentPrice?.toLocaleString() || "0.00"}
                  </Text>
                </div>
                <Input
                  value={field.value}
                  onChange={(_, data) => field.onChange(data.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  type="number"
                  step="0.01"
                  style={{ width: "100%", fontFamily: "var(--ct-font-mono)" }}
                />
              </Field>
            )}
          />
        )}

        {watchOrderType === OrderType.Market && (
          <div className={styles.infoBox}>
            <Text size={200} style={{ color: "var(--ct-text-secondary)" }}>
              Executes immediately at best available price
            </Text>
            <br />
            <Text size={100} style={{ color: "#FBBF24", fontFamily: "var(--ct-font-mono)" }}>
              Market Buys lock +5% collateral for slippage
            </Text>
          </div>
        )}

        <Controller
          name="quantity"
          control={control}
          render={({ field }) => (
            <Field
              validationMessage={errors.quantity?.message}
              validationState={errors.quantity ? "error" : "none"}
            >
              <div className={styles.priceRow}>
                <Text size={200} style={{ color: "var(--ct-text-secondary)", fontFamily: "var(--ct-font-sans)" }}>
                  Quantity ({symbol.replace("USDT", "").replace("USD", "")})
                </Text>
              </div>
              <Input
                value={field.value}
                onChange={(_, data) => field.onChange(data.value)}
                onBlur={field.onBlur}
                name={field.name}
                type="number"
                step="0.0001"
                style={{ width: "100%", fontFamily: "var(--ct-font-mono)" }}
              />
            </Field>
          )}
        />

        <div className={styles.infoBox}>
          <Text size={200} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-sans)" }}>
            {watchOrderType === OrderType.Market ? "Estimated Total" : "Order Value"}
          </Text>
          <br />
          <Text weight="bold" size={500} style={{ fontFamily: "var(--ct-font-mono)", letterSpacing: "-0.02em" }}>
            ${estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className={styles.submitBtn}
          style={{
            backgroundColor: isBuy ? "var(--ct-bullish)" : "var(--ct-bearish)",
            color: "white",
            boxShadow: isBuy ? "var(--ct-glow-bullish)" : "var(--ct-glow-bearish)",
          }}
        >
          {isSubmitting ? <Spinner size="tiny" /> : `${watchSide} ${symbol.replace("USDT", "")}`}
        </Button>
      </form>
    </Card>
  );
};
