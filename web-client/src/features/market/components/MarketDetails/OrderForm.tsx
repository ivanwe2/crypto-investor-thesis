import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  Field,
} from "@fluentui/react-components";
import { orderService } from "../../../trading/services/orderService";
import { useNotificationStore } from "../../../../shared/store/notificationStore";
import { OrderSide, OrderType } from "../../../trading/dtos/OrderDtos";

// ✨ Strict Object Validation: nativeEnum works perfectly with 'as const' objects
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

const useStyles = makeStyles({
  card: { backgroundColor: tokens.colorNeutralBackground1Hover },
  formBody: { display: "flex", flexDirection: "column", ...shorthands.gap("16px") },
  infoBox: {
    ...shorthands.padding("12px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius("8px"),
    textAlign: "center",
  },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" },
  clickableText: {
    color: tokens.colorBrandForeground1,
    cursor: "pointer",
    ":hover": { textDecorationLine: "underline" },
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
    // Safely map the string objects to the C# integer domain
    const sideEnum = data.side === OrderSide.Buy ? 1 : 2;
    
    let typeEnum = 2; // Limit
    if (data.orderType === OrderType.Market) typeEnum = 1;
    if (data.orderType === OrderType.StopLoss) typeEnum = 3;
    if (data.orderType === OrderType.TakeProfit) typeEnum = 4;

    const parsedQty = Number(data.quantity);
    let finalTargetPrice = data.targetPrice ? Number(data.targetPrice) : undefined;
    let finalStopPrice = data.stopPrice ? Number(data.stopPrice) : undefined;

    if (typeEnum === 1) { // Market Order VWAP preview adjustment
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
      <CardHeader header={<Text weight="semibold" size={500}>Place Order</Text>} />

      <Controller
        name="orderType"
        control={control}
        render={({ field }) => (
          <TabList
            selectedValue={field.value}
            onTabSelect={(_, data) => field.onChange(data.value as OrderType)}
            style={{ marginBottom: "8px" }}
          >
            <Tab value={OrderType.Limit}>Limit</Tab>
            <Tab value={OrderType.Market}>Market</Tab>
            <Tab value={OrderType.StopLoss}>Stop Loss</Tab>
            <Tab value={OrderType.TakeProfit}>Take Profit</Tab>
          </TabList>
        )}
      />

      <form onSubmit={handleSubmit(onSubmit)} className={styles.formBody}>
        <Controller
          name="side"
          control={control}
          render={({ field }) => (
            <RadioGroup value={field.value} onChange={(_, d) => field.onChange(d.value as OrderSide)} layout="horizontal">
              <Radio value={OrderSide.Buy} label={<Text style={{ color: tokens.colorPaletteGreenForeground1, fontWeight: field.value === OrderSide.Buy ? "bold" : "normal" }}>Buy</Text>} />
              <Radio value={OrderSide.Sell} label={<Text style={{ color: tokens.colorPaletteRedForeground1, fontWeight: field.value === OrderSide.Sell ? "bold" : "normal" }}>Sell</Text>} />
            </RadioGroup>
          )}
        />

        {watchOrderType === OrderType.Limit && (
          <Controller
            name="targetPrice"
            control={control}
            render={({ field }) => (
              <Field validationMessage={errors.targetPrice?.message} validationState={errors.targetPrice ? "error" : "none"}>
                <div className={styles.priceRow}>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Limit Price (USD)</Text>
                  <Text size={200} className={styles.clickableText} onClick={() => setValue("targetPrice", currentPrice.toString(), { shouldValidate: true })} title="Click to copy current price">
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
                  style={{ width: "100%" }} 
                />
              </Field>
            )}
          />
        )}

        {/* ✨ CEP Stop Price Input */}
        {[OrderType.StopLoss, OrderType.TakeProfit].includes(watchOrderType as any) && (
          <Controller
            name="stopPrice"
            control={control}
            render={({ field }) => (
              <Field validationMessage={errors.stopPrice?.message} validationState={errors.stopPrice ? "error" : "none"}>
                <div className={styles.priceRow}>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Trigger Stop Price (USD)</Text>
                  <Text size={200} className={styles.clickableText} onClick={() => setValue("stopPrice", currentPrice.toString(), { shouldValidate: true })} title="Click to copy current price">
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
                  style={{ width: "100%" }} 
                />
              </Field>
            )}
          />
        )}

        {watchOrderType === OrderType.Market && (
          <div className={styles.infoBox}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Executes immediately at the best available market price.</Text>
            <br />
            <Text size={100} style={{ color: tokens.colorPaletteYellowBackground1 }}>
              Note: Market Buys temporarily lock +5% collateral to account for potential slippage. Excess funds are instantly refunded upon settlement.
            </Text>
          </div>
        )}

        <Controller
          name="quantity"
          control={control}
          render={({ field }) => (
            <Field validationMessage={errors.quantity?.message} validationState={errors.quantity ? "error" : "none"}>
              <div className={styles.priceRow}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Quantity ({symbol.replace("USDT", "").replace("USD", "")})</Text>
              </div>
              <Input 
                value={field.value} 
                onChange={(_, data) => field.onChange(data.value)} 
                onBlur={field.onBlur}
                name={field.name}
                type="number" 
                step="0.0001" 
                style={{ width: "100%" }} 
              />
            </Field>
          )}
        />

        <div className={styles.infoBox}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {watchOrderType === OrderType.Market ? "Estimated Total Value" : "Total Order Value"}
          </Text>
          <br />
          <Text weight="bold" size={400}>
            ${estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          style={{
            backgroundColor: isBuy ? tokens.colorPaletteGreenBackground3 : tokens.colorPaletteRedBackground3,
            color: "white", height: "44px", fontSize: "16px", fontWeight: "bold", transition: "all 0.2s ease"
          }}
        >
          {isSubmitting ? <Spinner size="tiny" /> : `${watchSide} ${symbol}`}
        </Button>
      </form>
    </Card>
  );
};