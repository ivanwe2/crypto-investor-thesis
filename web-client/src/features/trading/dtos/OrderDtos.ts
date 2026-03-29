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
  createdAt: string;
}

export interface TradeData {
  tradeId: string;
  symbol: string;
  price: number;
  quantity: number;
  timestamp: number;
  isBuyerMaker: boolean;
}

export interface TradeHistoryDto {
  id: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  executionPrice: number;
  status: string;
  executedAt: string;
}