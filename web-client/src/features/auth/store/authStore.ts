import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';

interface CustomJwtPayload {
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"?: string;
    role?: string;
    exp?: number;
    sub?: string;
}

interface AuthState {
    token: string | null;
    username: string | null;
    userId: string | null;
    role: string | null;
    
    login: (token: string, username: string, userId: string) => void;
    logout: () => void;
    isAuthenticated: () => boolean;
    isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            username: null,
            userId: null,
            role: null,

            login: (token, username, userId) => {
                try {
                    const decoded = jwtDecode<CustomJwtPayload>(token);
                    
                    const roleClaimKey = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
                    const extractedRole = decoded[roleClaimKey] || decoded.role || 'User';

                    set({ token, username, userId, role: extractedRole });
                } catch (error) {
                    console.error("Failed to parse JWT token on login:", error);
                    set({ token, username, userId, role: 'User' });
                }
            },
            
            logout: () => set({ token: null, username: null, userId: null, role: null }),
            
            isAuthenticated: () => {
                const token = get().token;
                if (!token) return false;

                try {
                    const decoded = jwtDecode<CustomJwtPayload>(token);
                    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                        get().logout();
                        return false;
                    }
                    return true;
                } catch {
                    return false;
                }
            },

            isAdmin: () => get().role === 'Admin',
        }),
        {
            name: 'auth-storage',
        }
    )
);