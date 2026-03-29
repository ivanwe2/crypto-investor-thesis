export const OrderSide = {
  Buy: 'Buy',
  Sell: 'Sell'
} as const;

export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

export const OrderType = {
  Market: 'Market',
  Limit: 'Limit',
  StopLoss: 'StopLoss',
  TakeProfit: 'TakeProfit'
} as const;

export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export interface PlaceOrderRequest {
  symbol: string;
  side: number; // Maps to C# integer
  type: number; // Maps to C# integer
  quantity: number;
  targetPrice: number;
  stopPrice?: number;
}

export interface OrderResponse {
  orderId: string;
  status: string;
  message: string;
}

export interface OpenOrderDto {
  id: string;
  symbol: string;
  side: OrderSide | string;
  type: OrderType | string;
  quantity: number;
  targetPrice: number;
  status: string;
  createdAtUtc: string;
  stopPrice?: number;
}