import { apiClient } from './apiClient';
import type { PlaceOrderRequest, OrderResponse } from '../dtos/OrderDtos';
import { AppConfig } from '../config/AppConfig';

export const orderService = {
    placeOrder: async (request: PlaceOrderRequest): Promise<OrderResponse> => {
        const response = await apiClient.post<OrderResponse>(AppConfig.Endpoints.Orders, request);
        return response.data;
    }
};