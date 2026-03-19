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

const orderSchema = z
  .object({
    orderType: z.enum(["Limit", "Market"]),
    side: z.enum(["Buy", "Sell"]),
    quantity: z
      .string()
      .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Quantity must be greater than 0",
      }),
    targetPrice: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.orderType === "Limit") {
        return (
          !!data.targetPrice &&
          !isNaN(Number(data.targetPrice)) &&
          Number(data.targetPrice) > 0
        );
      }
      return true;
    },
    {
      message: "Limit Price must be greater than 0",
      path: ["targetPrice"],
    },
  );

type OrderFormValues = z.infer<typeof orderSchema>;

const useStyles = makeStyles({
  card: { backgroundColor: tokens.colorNeutralBackground1Hover },
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
    ":hover": { textDecorationLine: "underline" },
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
  const { addNotification } = useNotificationStore();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      orderType: "Limit",
      side: "Buy",
      quantity: "1", // Now strictly strings to match HTML inputs
      targetPrice: currentPrice ? currentPrice.toString() : "",
    },
    mode: "onTouched",
  });

  const watchOrderType = watch("orderType");
  const watchSide = watch("side");
  const watchQuantity = watch("quantity");
  const watchTargetPrice = watch("targetPrice");

  useEffect(() => {
    if (currentPrice && !watchTargetPrice && watchOrderType === "Limit") {
      setValue("targetPrice", currentPrice.toString(), {
        shouldValidate: true,
      });
    }
  }, [currentPrice, watchTargetPrice, watchOrderType, setValue]);

  const onSubmit = async (data: OrderFormValues) => {
    // ✨ FIX 3: Explicitly type as 1 | 2 to perfectly match the .NET Enums
    const typeEnum: 1 | 2 = data.orderType === "Market" ? 1 : 2;
    const sideEnum: 1 | 2 = data.side === "Buy" ? 1 : 2;
    const parsedQty = Number(data.quantity);
    const parsedPrice = data.targetPrice ? Number(data.targetPrice) : undefined;

    try {
      await orderService.placeOrder({
        symbol,
        side: sideEnum,
        type: typeEnum,
        quantity: parsedQty,
        targetPrice: typeEnum === 2 ? parsedPrice : undefined,
      });

      const priceText = typeEnum === 1 ? "Market Price" : `@ $${parsedPrice}`;
      addNotification(
        `${data.orderType} order submitted: ${data.side} ${parsedQty} ${symbol} ${priceText}`,
        "success",
      );
    } catch (error: any) {
      console.error("Order failed", error);
      addNotification(
        error.response?.data?.message ||
          error.response?.data ||
          "Failed to place order.",
        "error",
      );
    }
  };

  const isBuy = watchSide === "Buy";
  const effectivePrice =
    watchOrderType === "Limit" ? Number(watchTargetPrice) || 0 : currentPrice;
  const estimatedTotal = (Number(watchQuantity) || 0) * (effectivePrice || 0);

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <Text weight="semibold" size={500}>
            Place Order
          </Text>
        }
      />

      <Controller
        name="orderType"
        control={control}
        render={({ field }) => (
          <TabList
            selectedValue={field.value}
            onTabSelect={(_, data) => field.onChange(data.value)}
            style={{ marginBottom: "8px" }}
          >
            <Tab value="Limit">Limit</Tab>
            <Tab value="Market">Market</Tab>
          </TabList>
        )}
      />

      <form onSubmit={handleSubmit(onSubmit)} className={styles.formBody}>
        <Controller
          name="side"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onChange={(_, d) => field.onChange(d.value)}
              layout="horizontal"
            >
              <Radio
                value="Buy"
                label={
                  <Text
                    style={{
                      color: tokens.colorPaletteGreenForeground1,
                      fontWeight: field.value === "Buy" ? "bold" : "normal",
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
                      fontWeight: field.value === "Sell" ? "bold" : "normal",
                    }}
                  >
                    Sell
                  </Text>
                }
              />
            </RadioGroup>
          )}
        />

        {watchOrderType === "Limit" && (
          <Controller
            name="targetPrice"
            control={control}
            render={({ field }) => (
              <Field
                validationMessage={errors.targetPrice?.message}
                validationState={errors.targetPrice ? "error" : "none"}
              >
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
                    onClick={() =>
                      setValue("targetPrice", currentPrice.toString(), {
                        shouldValidate: true,
                      })
                    }
                    title="Click to copy current price"
                  >
                    Use Last: ${currentPrice?.toLocaleString() || "0.00"}
                  </Text>
                </div>
                {/* ✨ FIX 4: Explicitly map Fluent UI's onChange to RHF's field.onChange */}
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

        {watchOrderType === "Market" && (
          <div className={styles.infoBox}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Executes immediately at the best available market price.
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
                <Text
                  size={200}
                  style={{ color: tokens.colorNeutralForeground3 }}
                >
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
                style={{ width: "100%" }}
              />
            </Field>
          )}
        />

        <div className={styles.infoBox}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {watchOrderType === "Market"
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
          {isSubmitting ? <Spinner size="tiny" /> : `${watchSide} ${symbol}`}
        </Button>
      </form>
    </Card>
  );
};
