import { apiClient } from './apiClient';
import type { WalletResponse } from '../dtos/WalletDtos';

export const walletService = {
    getMyWallet: async (): Promise<WalletResponse> => {
        const response = await apiClient.get<WalletResponse>('/api/wallets/my-wallet');
        return response.data;
    }
};