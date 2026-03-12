export interface TradeHistoryDto {
    id: string;
    symbol: string;
    side: string;
    type: string;
    quantity: number;
    targetPrice: number;
    executionPrice: number | null; // Null if cancelled or not yet filled
    status: string;
    timestamp: string; // ISO 8601 date string
}