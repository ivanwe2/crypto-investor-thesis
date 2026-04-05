export interface TradeHistoryDto {
  id: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  targetPrice: number;
  executionPrice: number | null;
  status: string;
  timestamp: string;
}
