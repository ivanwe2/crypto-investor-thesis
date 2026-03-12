export interface MarketTicker {
    symbol: string;
    price: number;
    timestamp: number;
    trend: 'up' | 'down' | 'neutral';
    volatility: number;
}