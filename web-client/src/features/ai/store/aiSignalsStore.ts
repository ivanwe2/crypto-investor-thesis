import { create } from 'zustand';

export interface AiSignal {
  id: string;
  symbol: string;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  reason: string;
  side: string;
  timestamp: string;
  receivedAt: Date;
}

interface AiSignalsState {
  signals: AiSignal[];
  addSignal: (data: Omit<AiSignal, 'id' | 'receivedAt'>) => void;
  clearSignals: () => void;
}

export const useAiSignalsStore = create<AiSignalsState>((set) => ({
  signals: [],
  addSignal: (data) => {
    const signal: AiSignal = { ...data, id: crypto.randomUUID(), receivedAt: new Date() };
    set((state) => ({ signals: [signal, ...state.signals].slice(0, 50) }));
  },
  clearSignals: () => set({ signals: [] }),
}));
