import { apiClient } from '../../../shared/services/apiClient';
import { AppConfig } from '../../../shared/config/AppConfig';
import type { PlaceOrderRequest, OrderResponse, OpenOrderDto } from '../dtos/OrderDtos';
import type { TradeHistoryDto } from '../dtos/TradeHistoryDto';

export const orderService = {
    placeOrder: async (request: PlaceOrderRequest): Promise<OrderResponse> => {
        const response = await apiClient.post<OrderResponse>(AppConfig.Endpoints.Orders, request);
        return response.data;
    },
    getOpenOrders: async (): Promise<OpenOrderDto[]> => {
        const response = await apiClient.get<OpenOrderDto[]>(`${AppConfig.Endpoints.Orders}/open`);
        return response.data;
    },
    cancelOrder: async (id: string): Promise<void> => {
        await apiClient.delete(`${AppConfig.Endpoints.Orders}/${id}`);
    },
    getTradeHistory: async (limit: number = 50): Promise<TradeHistoryDto[]> => {
        const response = await apiClient.get<TradeHistoryDto[]>(`${AppConfig.Endpoints.Orders}/history?limit=${limit}`);
        return response.data;
    },
};