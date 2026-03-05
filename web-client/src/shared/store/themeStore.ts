import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
    isDark: boolean;
    toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            isDark: true, // Default to Dark Mode for trading terminals!
            toggleTheme: () => set((state) => ({ isDark: !state.isDark }))
        }),
        { name: 'theme-storage' }
    )
);