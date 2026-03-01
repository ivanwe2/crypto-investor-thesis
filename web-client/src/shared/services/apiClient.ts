import axios from 'axios';
import { AppConfig } from '../config/AppConfig';
import { useAuthStore } from '../../features/auth/store/authStore';

export const apiClient = axios.create({
    baseURL: AppConfig.ApiBaseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
            console.warn("Session expired. Please log in again.");
        }
        return Promise.reject(error);
    }
);