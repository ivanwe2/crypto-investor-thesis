import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Text,
  Button,
  Spinner,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  TabList,
  Tab,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import {
  DismissCircle16Regular,
  ArrowClockwise16Regular,
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
  Clock16Regular,
} from "@fluentui/react-icons";
import { orderService } from "../../services/orderService";
import {
  OrderSide,
  OrderType,
  type OpenOrderDto,
} from "../../dtos/OrderDtos";
import type { TradeHistoryDto } from "../../dtos/TradeHistoryDto";

const useStyles = makeStyles({
  page: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("20px"),
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    animation: "ct-fade-in 0.35s ease-out both",
  },
  headerSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  pageTitle: {
    fontFamily: "var(--ct-font-sans)",
    letterSpacing: "-0.03em",
  },
  tableCard: {
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    ...shorthands.padding("0"),
    ...shorthands.overflow("hidden"),
  },
  tableHeader: {
    backgroundColor: "var(--ct-bg-elevated)",
    fontFamily: "var(--ct-font-mono)",
    fontSize: "11px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  tableRow: {
    ...shorthands.borderBottom("1px", "solid", "var(--ct-border)"),
    transitionProperty: "background-color",
    transitionDuration: "0.15s",
    ":hover": {
      backgroundColor: "rgba(255,255,255,0.02)",
    },
  },
  monoCell: {
    fontFamily: "var(--ct-font-mono)",
    fontSize: "13px",
  },
  emptyState: {
    ...shorthands.padding("48px"),
    textAlign: "center",
    color: "var(--ct-text-muted)",
  },
  loadingState: {
    ...shorthands.padding("48px"),
    display: "flex",
    justifyContent: "center",
  },
});

export const OrdersPage = () => {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const {
    data: openOrdersData,
    isLoading: isLoadingOpen,
    isFetching: isFetchingOpen,
    refetch: refetchOpen,
  } = useQuery({
    queryKey: ["orders", "open"],
    queryFn: orderService.getOpenOrders,
    staleTime: 5000,
  });

  const openOrders = openOrdersData ?? [];

  const {
    data: tradeHistory = [],
    isLoading: isLoadingHistory,
    isFetching: isFetchingHistory,
    refetch: refetchHistory,
  } = useQuery<TradeHistoryDto[]>({
    queryKey: ["orders", "history"],
    queryFn: () => orderService.getTradeHistory(50),
    staleTime: 15000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => orderService.cancelOrder(id),
    onMutate: (id) => setCancellingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "open"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "history"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onSettled: () => setCancellingId(null),
    onError: (error) => {
      console.error("Failed to cancel order", error);
      alert("Failed to cancel order. It may have already been filled.");
    },
  });

  const isFetching = activeTab === "open" ? isFetchingOpen : isFetchingHistory;
  const handleRefetch = () =>
    activeTab === "open" ? refetchOpen() : refetchHistory();

  const renderStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "FILLED")
      return (
        <Badge color="success" icon={<CheckmarkCircle16Regular />} appearance="tint"
          style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
          Filled
        </Badge>
      );
    if (s === "CANCELLED")
      return (
        <Badge color="danger" icon={<ErrorCircle16Regular />} appearance="tint"
          style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
          Cancelled
        </Badge>
      );
    return (
      <Badge color="warning" icon={<Clock16Regular />} appearance="tint"
        style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
        {status}
      </Badge>
    );
  };

  const renderPriceCell = (order: OpenOrderDto) => {
    if (order.type === OrderType.Market) {
      return <Text className={styles.monoCell} style={{ color: "var(--ct-text-muted)" }}>Market</Text>;
    }

    if (order.type === OrderType.StopLoss || order.type === OrderType.TakeProfit) {
      return (
        <Badge appearance="tint" color="warning" shape="rounded" style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
          Trigger: ${order.stopPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </Badge>
      );
    }

    return (
      <Text className={styles.monoCell}>
        ${order.targetPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </Text>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerSection}>
        <div>
          <Text size={800} weight="bold" className={styles.pageTitle}>
            Orders & History
          </Text>
          <Text size={300} style={{ color: "var(--ct-text-muted)", display: "block", marginTop: 4 }}>
            Manage active limits and review settled trades
          </Text>
        </div>

        <Button
          icon={isFetching ? <Spinner size="tiny" /> : <ArrowClockwise16Regular />}
          appearance="secondary"
          size="small"
          onClick={handleRefetch}
          disabled={isFetching}
          style={{ borderRadius: "var(--ct-radius-sm)" }}
        >
          Refresh
        </Button>
      </div>

      <TabList
        selectedValue={activeTab}
        onTabSelect={(_, data) => setActiveTab(data.value as "open" | "history")}
      >
        <Tab value="open">Open Orders ({openOrders.length})</Tab>
        <Tab value="history">Trade History</Tab>
      </TabList>

      <Card className={styles.tableCard}>
        {/* OPEN ORDERS */}
        {activeTab === "open" &&
          (isLoadingOpen ? (
            <div className={styles.loadingState}>
              <Spinner label="Loading open orders..." />
            </div>
          ) : openOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <Text>No open orders</Text>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table aria-label="Open Orders Table">
                <TableHeader className={styles.tableHeader}>
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Symbol</TableHeaderCell>
                    <TableHeaderCell>Side</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Price</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell style={{ textAlign: "right" }}>Action</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openOrders.map((order) => (
                    <TableRow key={order.id} className={styles.tableRow}>
                      <TableCell>
                        <Text size={200} className={styles.monoCell} style={{ color: "var(--ct-text-muted)" }}>
                          {new Date(order.createdAtUtc).toLocaleString(undefined, {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text weight="bold" style={{ fontFamily: "var(--ct-font-sans)" }}>{order.symbol}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge
                          appearance="filled"
                          color={order.side === OrderSide.Buy ? "success" : "danger"}
                          shape="rounded"
                          style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}
                        >
                          {order.side}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text className={styles.monoCell}>{order.type}</Text>
                      </TableCell>
                      <TableCell>{renderPriceCell(order)}</TableCell>
                      <TableCell>
                        <Text className={styles.monoCell}>{order.quantity}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge appearance="outline" color="informative" shape="rounded"
                          style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ textAlign: "right" }}>
                        <Button
                          icon={cancellingId === order.id ? <Spinner size="tiny" /> : <DismissCircle16Regular />}
                          appearance="transparent"
                          size="small"
                          style={{ color: "var(--ct-bearish)" }}
                          onClick={() => cancelMutation.mutate(order.id)}
                          disabled={cancellingId === order.id}
                        >
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}

        {/* TRADE HISTORY */}
        {activeTab === "history" &&
          (isLoadingHistory ? (
            <div className={styles.loadingState}>
              <Spinner label="Loading history..." />
            </div>
          ) : tradeHistory.length === 0 ? (
            <div className={styles.emptyState}>
              <Text>No completed trades yet</Text>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table aria-label="Trade History Table">
                <TableHeader className={styles.tableHeader}>
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Symbol</TableHeaderCell>
                    <TableHeaderCell>Side</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Target</TableHeaderCell>
                    <TableHeaderCell>Executed</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell style={{ textAlign: "center" }}>Status</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tradeHistory.map((trade) => (
                    <TableRow key={trade.id} className={styles.tableRow}>
                      <TableCell>
                        <Text size={200} className={styles.monoCell} style={{ color: "var(--ct-text-muted)" }}>
                          {new Date(trade.timestamp).toLocaleString(undefined, {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
                          })}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text weight="bold" style={{ fontFamily: "var(--ct-font-sans)" }}>{trade.symbol}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge
                          appearance="filled"
                          color={trade.side.toUpperCase() === "BUY" ? "success" : "danger"}
                          shape="rounded"
                          style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}
                        >
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text className={styles.monoCell}>{trade.type}</Text>
                      </TableCell>
                      <TableCell>
                        <Text
                          className={styles.monoCell}
                          style={
                            trade.executionPrice
                              ? { textDecoration: "line-through", color: "var(--ct-text-muted)" }
                              : {}
                          }
                        >
                          {trade.type === OrderType.Market
                            ? "Market"
                            : `$${trade.targetPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}`}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text weight="bold" className={styles.monoCell} style={{ color: "var(--ct-brand)" }}>
                          {trade.executionPrice
                            ? `$${trade.executionPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : "-"}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text className={styles.monoCell}>{trade.quantity}</Text>
                      </TableCell>
                      <TableCell style={{ textAlign: "center" }}>
                        {renderStatusBadge(trade.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
      </Card>
    </div>
  );
};
