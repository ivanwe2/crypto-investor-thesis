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
  tokens
} from "@fluentui/react-components";
import { DismissCircle16Regular, ArrowClockwise16Regular } from "@fluentui/react-icons";
import { orderService } from "../../services/orderService";
import type { OpenOrderDto } from "../../dtos/OrderDtos";

export const OrdersPage = () => {
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // 1. Fetch Open Orders from .NET / Redis
  const { data: orders = [], isLoading, isFetching, refetch } = useQuery<OpenOrderDto[]>({
    queryKey: ["orders", "open"],
    queryFn: orderService.getOpenOrders,
    staleTime: 5000,
  });

  // 2. Cancel Order Mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => orderService.cancelOrder(id),
    onMutate: (id) => setCancellingId(id),
    onSuccess: () => {
      // Invalidate both so the UI table updates and the Wallet balances refresh
      queryClient.invalidateQueries({ queryKey: ["orders", "open"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onSettled: () => setCancellingId(null),
    onError: (error) => {
      console.error("Failed to cancel order", error);
      alert("Failed to cancel order. It may have already been filled.");
    }
  });

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Text size={800} weight="bold">Active Orders</Text>
          <div style={{ marginTop: "4px" }}>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              Manage your pending limit orders across all markets.
            </Text>
          </div>
        </div>
        
        <Button 
          icon={isFetching ? <Spinner size="tiny" /> : <ArrowClockwise16Regular />} 
          appearance="secondary"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Refresh Data
        </Button>
      </div>

      <Card style={{ backgroundColor: tokens.colorNeutralBackground1Hover, padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
            <Spinner label="Loading orders from Redis..." />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Text size={400} style={{ color: tokens.colorNeutralForeground3 }}>You have no open orders.</Text>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table aria-label="Open Orders Table">
              <TableHeader style={{ backgroundColor: tokens.colorNeutralBackground2 }}>
                <TableRow>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Symbol</TableHeaderCell>
                  <TableHeaderCell>Side</TableHeaderCell>
                  <TableHeaderCell>Price</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell style={{ textAlign: "right" }}>Action</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                    
                    <TableCell>
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                        {new Date(order.createdAtUtc).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                      <Text>${order.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </TableCell>
                    
                    <TableCell>
                      <Text>{order.quantity}</Text>
                    </TableCell>
                    
                    <TableCell>
                      <Badge appearance="outline" color="informative" shape="rounded">
                        {order.status}
                      </Badge>
                    </TableCell>
                    
                    <TableCell style={{ textAlign: "right" }}>
                      <Button
                        appearance="transparent"
                        icon={cancellingId === order.id ? <Spinner size="tiny" /> : <DismissCircle16Regular />}
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
        )}
      </Card>
    </div>
  );
};