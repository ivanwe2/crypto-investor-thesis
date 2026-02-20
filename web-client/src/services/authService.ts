import { apiClient } from './apiClient';
import type { RegisterRequest, LoginRequest, AuthResponse } from '../dtos/AuthDtos';

export const authService = {
    login: async (request: LoginRequest): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', request);
        return response.data;
    },

    register: async (request: RegisterRequest): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>('/api/v1/auth/register', request);
        return response.data;
    }
};