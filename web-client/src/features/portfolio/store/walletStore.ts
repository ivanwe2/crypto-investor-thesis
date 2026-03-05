import { create } from 'zustand';
import { walletService } from '../services/walletService';
import type { WalletResponse } from '../dtos/WalletDtos';

interface WalletState {
    wallet: WalletResponse | null;
    isLoading: boolean;
    fetchWallet: () => Promise<void>;
    clearWallet: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
    wallet: null,
    isLoading: false,
    
    fetchWallet: async () => {
        set({ isLoading: true });
        try {
            const data = await walletService.getMyWallet();
            set({ wallet: data });
        } catch (err) {
            console.error("Failed to fetch wallet", err);
        } finally {
            set({ isLoading: false });
        }
    },

    clearWallet: () => set({ wallet: null })
}));