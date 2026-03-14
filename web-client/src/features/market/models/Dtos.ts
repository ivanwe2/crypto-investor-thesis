export interface KlineDto {
    startTimeUtc: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface KlinesResponse {
    symbol: string;
    klines: KlineDto[];
}

export interface OrderBookEntryDto {
    price: number;
    size: number;
}

export interface OrderBookResponse {
    symbol: string;
    bids: OrderBookEntryDto[];
    asks: OrderBookEntryDto[];
    lastUpdateId: number;
}