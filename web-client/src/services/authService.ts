import { apiClient } from './apiClient';
import type { RegisterRequest, LoginRequest, AuthResponse } from '../dtos/AuthDtos';
import { AppConfig } from '../config/AppConfig';

export const authService = {
    login: async (request: LoginRequest): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>(AppConfig.Endpoints.AuthLogin, request);
        return response.data;
    },

    register: async (request: RegisterRequest): Promise<AuthResponse> => {
        const response = await apiClient.post<AuthResponse>(AppConfig.Endpoints.AuthRegister, request);
        return response.data;
    }
};