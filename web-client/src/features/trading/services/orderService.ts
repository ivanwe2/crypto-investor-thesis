import { apiClient } from '../../../shared/services/apiClient';
import { AppConfig } from '../../../shared/config/AppConfig';
import type { PlaceOrderRequest, OrderResponse } from '../dtos/OrderDtos';

export const orderService = {
    placeOrder: async (request: PlaceOrderRequest): Promise<OrderResponse> => {
        const response = await apiClient.post<OrderResponse>(AppConfig.Endpoints.Orders, request);
        return response.data;
    }
};