import { create } from 'zustand';

export interface ToastNotification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface NotificationState {
    notifications: ToastNotification[];
    addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
    removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    
    addNotification: (message, type = 'info') => {
        const id = crypto.randomUUID();
        set((state) => ({
            notifications: [...state.notifications, { id, message, type }]
        }));

        // Auto-remove after 4 seconds
        setTimeout(() => {
            set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id)
            }));
        }, 4000);
    },

    removeNotification: (id) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id)
        }));
    }
}));