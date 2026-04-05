import { makeStyles, shorthands } from '@fluentui/react-components';
import { useNotificationStore } from '../../../shared/store/notificationStore';

const useStyles = makeStyles({
    container: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap('8px'),
        zIndex: 9999,
    },
    toast: {
        ...shorthands.padding('12px', '18px'),
        ...shorthands.borderRadius('var(--ct-radius-md)'),
        ...shorthands.border('1px', 'solid'),
        boxShadow: 'var(--ct-shadow-elevated)',
        cursor: 'pointer',
        maxWidth: '360px',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'var(--ct-font-sans)',
        transitionProperty: 'all',
        transitionDuration: '0.3s',
        transitionTimingFunction: 'ease-in-out',
        animationName: {
            from: { opacity: 0, transform: 'translateX(100%)' },
            to: { opacity: 1, transform: 'translateX(0)' }
        },
        animationDuration: '0.3s',
        animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        animationFillMode: 'forwards',
        backdropFilter: 'blur(12px)',
    }
});

const TOAST_STYLES: Record<string, { bg: string; fg: string; border: string; glow?: string }> = {
    success: {
        bg: 'rgba(34,197,94,0.12)',
        fg: '#4ADE80',
        border: 'rgba(34,197,94,0.25)',
        glow: '0 4px 16px rgba(34,197,94,0.15)',
    },
    error: {
        bg: 'rgba(239,68,68,0.12)',
        fg: '#F87171',
        border: 'rgba(239,68,68,0.25)',
        glow: '0 4px 16px rgba(239,68,68,0.15)',
    },
    info: {
        bg: 'var(--ct-bg-elevated)',
        fg: 'var(--ct-text-primary)',
        border: 'var(--ct-border-hover)',
    },
    ai: {
        bg: 'rgba(168,85,247,0.12)',
        fg: '#C084FC',
        border: 'rgba(168,85,247,0.3)',
        glow: '0 4px 20px rgba(168,85,247,0.2)',
    },
};

export const ToastContainer = () => {
    const styles = useStyles();
    const { notifications, removeNotification } = useNotificationStore();

    if (notifications.length === 0) return null;

    return (
        <div className={styles.container}>
            {notifications.map((toast) => {
                const scheme = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

                return (
                    <div
                        key={toast.id}
                        className={styles.toast}
                        style={{
                            backgroundColor: scheme.bg,
                            color: scheme.fg,
                            borderColor: scheme.border,
                            boxShadow: scheme.glow || 'var(--ct-shadow-card)',
                        }}
                        onClick={() => removeNotification(toast.id)}
                    >
                        <span style={{ whiteSpace: 'pre-line' }}>{toast.message}</span>
                    </div>
                );
            })}
        </div>
    );
};
