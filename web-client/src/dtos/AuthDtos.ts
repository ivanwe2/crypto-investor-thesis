export interface RegisterRequest {
    username: string;
    password: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    username: string;
    userId: string;
}