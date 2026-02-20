export const AppConfig = {
    ApiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    
    SignalR: {
        HubPath: '/hubs/market',
        Events: {
            // The method name the Backend calls on the Frontend
            ReceivePriceUpdate: 'ReceivePriceUpdate',
        },
        Methods: {
            // The method name the Frontend calls on the Backend
            JoinGroup: 'JoinMarketGroup',
        }
    },

    Endpoints: {
        Analysis: '/api/v1/analysis'
    }
};