import { apiClient } from './apiClient';
import type { RegisterRequest, LoginRequest, AuthResponse } from '../dtos/AuthDtos';

export const authService = {
    login: async (request: LoginRequest): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>('/api/auth/login', request);
        return response.data;
    },

    register: async (request: RegisterRequest): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>('/api/auth/register', request);
        return response.data;
    }
};