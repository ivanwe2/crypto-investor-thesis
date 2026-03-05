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
                }

                return (
                    <div 
                        key={toast.id} 
                        className={styles.toast}
                        style={{
                            backgroundColor: bgColor,
                            color: fgColor,
                            borderColor: borderColor,
                        }}
                        onClick={() => removeNotification(toast.id)}
                    >
                        {toast.message}
                    </div>
                );
            })}
        </div>
    );
};