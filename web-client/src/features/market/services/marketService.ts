import { AppConfig } from "../../../shared/config/AppConfig";
import { apiClient } from "../../../shared/services/apiClient";
import type { KlinesResponse, OrderBookResponse } from "../models/Dtos";

export const marketService = {
    getHistoricalKlines: async (symbol: string, interval: string = '1m', limit: number = 50): Promise<KlinesResponse> => {
        const response = await apiClient.get<KlinesResponse>(`${AppConfig.Endpoints.Markets}/${symbol}/klines`, {
            params: { interval, limit }
        });
        return response.data;
    },
    
    getOrderBookDepth: async (symbol: string, limit: number = 15): Promise<OrderBookResponse> => {
        const response = await apiClient.get<OrderBookResponse>(`${AppConfig.Endpoints.Markets}/${symbol}/orderbook`, {
            params: { limit }
        });
        return response.data;
    }
};