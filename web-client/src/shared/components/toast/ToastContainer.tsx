import { tokens, makeStyles, shorthands } from '@fluentui/react-components';
import { useNotificationStore } from '../../../shared/store/notificationStore';

const useStyles = makeStyles({
    container: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap('10px'),
        zIndex: 9999,
    },
    toast: {
        ...shorthands.padding('15px', '20px'),
        ...shorthands.borderRadius('8px'),
        ...shorthands.border('1px', 'solid'),
        boxShadow: tokens.shadow16,
        cursor: 'pointer',
        maxWidth: '350px',
        fontSize: '0.95rem',
        fontWeight: 600,
        transitionProperty: 'all',
        transitionDuration: '0.3s',
        transitionTimingFunction: 'ease-in-out',
        animationName: {
            from: { opacity: 0, transform: 'translateX(100%)' },
            to: { opacity: 1, transform: 'translateX(0)' }
        },
        animationDuration: '0.3s',
        animationTimingFunction: 'ease-out',
        animationFillMode: 'forwards'
    }
});

export const ToastContainer = () => {
    const styles = useStyles();
    const { notifications, removeNotification } = useNotificationStore();

    if (notifications.length === 0) return null;

    return (
        <div className={styles.container}>
            {notifications.map((toast) => {
                let bgColor = tokens.colorNeutralBackground3;
                let fgColor = tokens.colorNeutralForeground1;
                let borderColor = tokens.colorNeutralStroke1;

                if (toast.type === 'success') {
                    bgColor = tokens.colorPaletteGreenBackground1;
                    fgColor = tokens.colorPaletteGreenForeground1;
                    borderColor = tokens.colorPaletteGreenBorder2;
                } else if (toast.type === 'error') {
                    bgColor = tokens.colorPaletteRedBackground1;
                    fgColor = tokens.colorPaletteRedForeground1;
                    borderColor = tokens.colorPaletteRedBorder2;
                } else if (toast.type === 'ai') {
                    bgColor = tokens.colorPalettePlumBackground2;
                    fgColor = tokens.colorPalettePlumForeground2;
                    borderColor = tokens.colorPalettePlumBorderActive;
                }

                return (
                    <div 
                        key={toast.id} 
                        className={styles.toast}
                        style={{
                            backgroundColor: bgColor,
                            color: fgColor,
                            borderColor: borderColor,
                            boxShadow: toast.type === 'ai' ? `0 4px 15px ${tokens.colorPalettePlumBackground2}` : tokens.shadow16
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