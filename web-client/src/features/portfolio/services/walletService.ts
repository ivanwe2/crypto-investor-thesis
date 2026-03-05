import { apiClient } from '../../../shared/services/apiClient';
import type { WalletResponse } from '../dtos/WalletDtos';
import { AppConfig } from '../../../shared/config/AppConfig';

export const walletService = {
    getMyWallet: async (): Promise<WalletResponse> => {
        const response = await apiClient.get<WalletResponse>(AppConfig.Endpoints.WalletsMyWallet);
        return response.data;
    }
};