// This interface matches the JSON properties sent by the Go Ingestor
// s = Symbol, p = Price, q = Quantity, T = Timestamp
export interface TradeData {
    s: string;
    p: number;
    q: number;
    T: number;
    v?: number;
}