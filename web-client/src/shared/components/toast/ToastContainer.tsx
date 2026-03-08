import { tokens } from '@fluentui/react-components';
import { useNotificationStore } from '../../store/notificationStore';
import styles from './ToastContainer.module.scss';

export const ToastContainer = () => {
    const { notifications, removeNotification } = useNotificationStore();

    if (notifications.length === 0) return null;

    return (
        <div className={styles.container}>
            {notifications.map((toast) => {
                // Map the toast types to Fluent UI Dark Theme tokens
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
                }else if (toast.type === 'ai') {
                    // ✨ NEW: AI Styling! Deep Plum/Purple colors native to Fluent UI
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
                            // If it's AI, add a cool subtle glow effect!
                            boxShadow: toast.type === 'ai' ? `0 4px 15px ${tokens.colorPalettePlumBackground2}` : '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                        onClick={() => removeNotification(toast.id)}
                    >
                        {/* If you want multi-line text (for the AI reason), white-space pre-line fixes it */}
                        <span style={{ whiteSpace: 'pre-line' }}>{toast.message}</span>
                    </div>
                );
            })}
        </div>
    );
};