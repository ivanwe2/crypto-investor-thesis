export interface AssetBalanceDto {
    currency: string;
    amount: number;
    currentPrice: number;
    averageEntryPrice: number | null;
}

export interface WalletResponse {
    walletId: string;
    balances: AssetBalanceDto[];
}