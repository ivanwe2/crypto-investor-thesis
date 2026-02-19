export interface PlaceOrderRequest {
    symbol: string;
    side: 1 | 2; // 1 = Buy, 2 = Sell (Matching our C# Enum)
    type: 1 | 2; // 1 = Market, 2 = Limit
    quantity: number;
    targetPrice?: number;
}

export interface OrderResponse {
    orderId: string;
    status: string;
    message: string;
}