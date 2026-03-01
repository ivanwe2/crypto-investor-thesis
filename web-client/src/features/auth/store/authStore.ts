import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    token: string | null;
    username: string | null;
    userId: string | null;
    
    login: (token: string, username: string, userId: string) => void;
    logout: () => void;
    isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            username: null,
            userId: null,

            login: (token, username, userId) => set({ token, username, userId }),
            
            logout: () => set({ token: null, username: null, userId: null }),
            
            isAuthenticated: () => !!get().token,
        }),
        {
            name: 'auth-storage', // name of the item in the window.localStorage
        }
    )
);