import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { LoginForm } from './auth/LoginForm';
import { RegisterForm } from './auth/RegisterForm';
import { WalletDisplay } from './auth/WalletDisplay';

export const AuthWidget = () => {
    const { isAuthenticated } = useAuthStore();
    const [isLoginMode, setIsLoginMode] = useState(true);

    return (
        <div style={widgetStyle}>
            {isAuthenticated() ? (
                <WalletDisplay />
            ) : isLoginMode ? (
                <LoginForm onSwitchMode={() => setIsLoginMode(false)} />
            ) : (
                <RegisterForm onSwitchMode={() => setIsLoginMode(true)} />
            )}
        </div>
    );
};

const widgetStyle: React.CSSProperties = { 
    border: '1px solid #ddd', 
    borderRadius: '8px', 
    padding: '1.5rem', 
    backgroundColor: '#fff', 
    height: 'fit-content',
    color: 'black'
};