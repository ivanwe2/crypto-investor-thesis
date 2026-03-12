import { create } from 'zustand';
import type { MarketTicker } from '../models/MarketTicker';
import type { TradeData } from '../../trading/dtos/TradeData';

interface MarketState {
    tickers: Record<string, MarketTicker>;
    updateTicker: (data: TradeData) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
    tickers: {},
    updateTicker: (data: TradeData) => set((state) => {
        const symbol = data.s;
        const price = Number(data.p);
        const prevTicker = state.tickers[symbol];
        const prevPrice = prevTicker?.price || price;

        let trend: 'up' | 'down' | 'neutral' = 'neutral';
        if (price > prevPrice) trend = 'up';
        if (price < prevPrice) trend = 'down';

        return {
            tickers: {
                ...state.tickers,
                [symbol]: {
                    symbol: symbol,
                    price: price,
                    timestamp: data.T,
                    trend: trend,
                    volatility: data.v ?? prevTicker?.volatility ?? 0
                }
            }
        };
    })
}));