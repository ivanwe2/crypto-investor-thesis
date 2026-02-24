import { useNotificationStore } from '../../store/notificationStore';

export const ToastContainer = () => {
    const { notifications, removeNotification } = useNotificationStore();

    if (notifications.length === 0) return null;

    return (
        <div style={containerStyle}>
            {notifications.map((toast) => (
                <div 
                    key={toast.id} 
                    style={{
                        ...toastStyle,
                        backgroundColor: toast.type === 'success' ? '#d4edda' : toast.type === 'error' ? '#f8d7da' : '#cce5ff',
                        color: toast.type === 'success' ? '#155724' : toast.type === 'error' ? '#721c24' : '#004085',
                        borderColor: toast.type === 'success' ? '#c3e6cb' : toast.type === 'error' ? '#f5c6cb' : '#b8daff',
                    }}
                    onClick={() => removeNotification(toast.id)}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
};

// --- STYLES ---
const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    zIndex: 9999,
};

const toastStyle: React.CSSProperties = {
    padding: '15px 20px',
    borderRadius: '8px',
    border: '1px solid',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    cursor: 'pointer',
    maxWidth: '350px',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    transition: 'all 0.3s ease-in-out',
    animation: 'slideIn 0.3s ease-out forwards',
};