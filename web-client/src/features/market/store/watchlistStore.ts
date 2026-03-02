import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WatchlistState {
    symbols: string[];
    addSymbol: (symbol: string) => void;
    removeSymbol: (symbol: string) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
    persist(
        (set) => ({
            symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"], // Default starters
            addSymbol: (symbol) => set((state) => {
                const upperSymbol = symbol.toUpperCase().trim();
                if (state.symbols.includes(upperSymbol) || !upperSymbol) return state;
                return { symbols: [...state.symbols, upperSymbol] };
            }),
            removeSymbol: (symbol) => set((state) => ({
                symbols: state.symbols.filter(s => s !== symbol)
            }))
        }),
        { name: 'watchlist-storage' }
    )
);