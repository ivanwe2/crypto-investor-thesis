export const AppConfig = {
    ApiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    
    SignalR: {
        HubPath: '/hubs/market',
        Events: {
            ReceivePriceUpdate: 'ReceivePriceUpdate',
            OrderFilled: 'OrderFilled'
        },
        Methods: {
            JoinGroup: 'JoinMarketGroup',
        }
    },
    
    Endpoints: {
        Analysis: '/api/v1/analysis',
        AuthLogin: '/api/v1/auth/login',
        AuthRegister: '/api/v1/auth/register',
        WalletsMyWallet: '/api/v1/wallets/my-wallet',
        Orders: '/api/v1/orders',
        Markets: '/api/v1/markets',
        SystemHealth: '/api/v1/system/health'
    }
};