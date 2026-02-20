import { apiClient } from './apiClient';
import type { PlaceOrderRequest, OrderResponse } from '../dtos/OrderDtos';

export const orderService = {
    placeOrder: async (request: PlaceOrderRequest): Promise<OrderResponse> => {
        const response = await apiClient.post<OrderResponse>('/api/orders', request);
        return response.data;
    }
};