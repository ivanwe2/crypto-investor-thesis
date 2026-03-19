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
  tokens,
  TabList,
  Tab,
} from "@fluentui/react-components";
import {
  DismissCircle16Regular,
  ArrowClockwise16Regular,
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
  Clock16Regular,
} from "@fluentui/react-icons";
import { orderService } from "../../services/orderService";
import type { OpenOrderDto } from "../../dtos/OrderDtos";
import type { TradeHistoryDto } from "../../dtos/TradeHistoryDto";

export const OrdersPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const {
    data: openOrders = [],
    isLoading: isLoadingOpen,
    isFetching: isFetchingOpen,
    refetch: refetchOpen,
  } = useQuery<OpenOrderDto[]>({
    queryKey: ["orders", "open"],
    queryFn: orderService.getOpenOrders,
    staleTime: 5000,
  });

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
        <Badge
          color="success"
          icon={<CheckmarkCircle16Regular />}
          appearance="tint"
        >
          Filled
        </Badge>
      );
    if (s === "CANCELLED")
      return (
        <Badge color="danger" icon={<ErrorCircle16Regular />} appearance="tint">
          Cancelled
        </Badge>
      );
    return (
      <Badge color="warning" icon={<Clock16Regular />} appearance="tint">
        {status}
      </Badge>
    );
  };

  return (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <Text size={800} weight="bold">
            Orders & History
          </Text>
          <div style={{ marginTop: "4px" }}>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              Manage your active limits and review your settled trades.
            </Text>
          </div>
        </div>

        <Button
          icon={
            isFetching ? <Spinner size="tiny" /> : <ArrowClockwise16Regular />
          }
          appearance="secondary"
          onClick={handleRefetch}
          disabled={isFetching}
        >
          Refresh Data
        </Button>
      </div>

      <TabList
        selectedValue={activeTab}
        onTabSelect={(_, data) =>
          setActiveTab(data.value as "open" | "history")
        }
      >
        <Tab value="open">Open Orders ({openOrders.length})</Tab>
        <Tab value="history">Trade History</Tab>
      </TabList>

      <Card
        style={{
          backgroundColor: tokens.colorNeutralBackground1Hover,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* --- OPEN ORDERS TAB --- */}
        {activeTab === "open" &&
          (isLoadingOpen ? (
            <div
              style={{
                padding: "40px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Spinner label="Loading open orders..." />
            </div>
          ) : openOrders.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Text
                size={400}
                style={{ color: tokens.colorNeutralForeground3 }}
              >
                You have no open orders.
              </Text>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table aria-label="Open Orders Table">
                <TableHeader
                  style={{ backgroundColor: tokens.colorNeutralBackground2 }}
                >
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Symbol</TableHeaderCell>
                    <TableHeaderCell>Side</TableHeaderCell>
                    <TableHeaderCell>Price</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell style={{ textAlign: "right" }}>
                      Action
                    </TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      style={{
                        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                      }}
                    >
                      <TableCell>
                        <Text
                          size={200}
                          style={{ color: tokens.colorNeutralForeground3 }}
                        >
                          {new Date(order.createdAtUtc).toLocaleString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text weight="bold">{order.symbol}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge
                          appearance="tint"
                          color={order.side === "Buy" ? "success" : "danger"}
                          shape="rounded"
                        >
                          {order.side}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text>
                          {order.type === "Market"
                            ? "Market"
                            : `$${order.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text>{order.quantity}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge
                          appearance="outline"
                          color="informative"
                          shape="rounded"
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ textAlign: "right" }}>
                        <Button
                          appearance="transparent"
                          icon={
                            cancellingId === order.id ? (
                              <Spinner size="tiny" />
                            ) : (
                              <DismissCircle16Regular />
                            )
                          }
                          style={{ color: tokens.colorPaletteRedForeground1 }}
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

        {/* --- TRADE HISTORY TAB --- */}
        {activeTab === "history" &&
          (isLoadingHistory ? (
            <div
              style={{
                padding: "40px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Spinner label="Loading history from ledger..." />
            </div>
          ) : tradeHistory.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Text
                size={400}
                style={{ color: tokens.colorNeutralForeground3 }}
              >
                You have no completed trades yet.
              </Text>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table aria-label="Trade History Table">
                <TableHeader
                  style={{ backgroundColor: tokens.colorNeutralBackground2 }}
                >
                  <TableRow>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Symbol</TableHeaderCell>
                    <TableHeaderCell>Side</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Target Price</TableHeaderCell>
                    <TableHeaderCell>Exec. Price</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell style={{ textAlign: "center" }}>
                      Status
                    </TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tradeHistory.map((trade) => (
                    <TableRow
                      key={trade.id}
                      style={{
                        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                      }}
                    >
                      <TableCell>
                        <Text
                          size={200}
                          style={{ color: tokens.colorNeutralForeground3 }}
                        >
                          {new Date(trade.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text weight="bold">{trade.symbol}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge
                          appearance="tint"
                          color={
                            trade.side.toUpperCase() === "BUY"
                              ? "success"
                              : "danger"
                          }
                          shape="rounded"
                        >
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text>{trade.type}</Text>
                      </TableCell>
                      <TableCell>
                        {/* ✨ FIX: Hide collateral lock price for Market Orders */}
                        <Text
                          style={
                            trade.executionPrice
                              ? {
                                  textDecoration: "line-through",
                                  color: tokens.colorNeutralForeground4,
                                }
                              : {}
                          }
                        >
                          {trade.type === "Market"
                            ? "Market"
                            : `$${trade.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text weight="bold">
                          {trade.executionPrice
                            ? `$${trade.executionPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : "-"}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text>{trade.quantity}</Text>
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
