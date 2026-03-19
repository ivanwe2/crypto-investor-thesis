import { create } from 'zustand';
import type { MarketTicker } from '../models/MarketTicker';
import type { TradeData } from '../../trading/dtos/TradeData';

interface MarketState {
    tickers: Record<string, MarketTicker>;
    updateTicker: (data: TradeData) => void;
    // ✨ FIX: Add a batch update method to prevent 100+ re-renders per second
    updateTickersBatch: (batch: Record<string, TradeData>) => void;
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
    }),

    updateTickersBatch: (batch: Record<string, TradeData>) => set((state) => {
        const nextTickers = { ...state.tickers };
        let hasChanges = false;

        for (const [symbol, data] of Object.entries(batch)) {
            const price = Number(data.p);
            const prevTicker = nextTickers[symbol];
            const prevPrice = prevTicker?.price || price;

            let trend: 'up' | 'down' | 'neutral' = 'neutral';
            if (price > prevPrice) trend = 'up';
            if (price < prevPrice) trend = 'down';

            nextTickers[symbol] = {
                symbol: symbol,
                price: price,
                timestamp: data.T,
                trend: trend,
                volatility: data.v ?? prevTicker?.volatility ?? 0
            };
            hasChanges = true;
        }

        return hasChanges ? { tickers: nextTickers } : state;
    })
}));