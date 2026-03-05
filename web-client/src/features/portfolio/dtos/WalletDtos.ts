export interface AssetBalanceDto {
    currency: string;
    amount: number;
}

export interface WalletResponse {
    walletId: string;
    balances: AssetBalanceDto[];
}