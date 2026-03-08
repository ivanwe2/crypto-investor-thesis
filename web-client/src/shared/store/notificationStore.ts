import { create } from 'zustand';

export interface ToastNotification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info'| 'ai'; 
}

interface NotificationState {
    notifications: ToastNotification[];
    addNotification: (message: string, type?: 'success' | 'error' | 'info' | 'ai') => void;
    removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    
    addNotification: (message, type = 'info') => {
        const id = crypto.randomUUID();
        set((state) => ({
            notifications: [...state.notifications, { id, message, type }]
        }));

        const timeoutMs = type === 'ai' ? 7000 : 4000;

        setTimeout(() => {
            set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id)
            }));
        }, timeoutMs);
    },

    removeNotification: (id) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id)
        }));
    }
}));