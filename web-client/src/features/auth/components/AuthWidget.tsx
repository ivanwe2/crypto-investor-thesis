import { useState } from 'react';
import { Card, tokens } from '@fluentui/react-components';
import { useAuthStore } from '../store/authStore';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { WalletDisplay } from '../../portfolio/components/WalletDisplay';

export const AuthWidget = () => {
    const { isAuthenticated } = useAuthStore();
    const [isLoginMode, setIsLoginMode] = useState(true);

    return (
        <Card style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}>
            {isAuthenticated() ? (
                <WalletDisplay />
            ) : isLoginMode ? (
                <LoginForm onSwitchMode={() => setIsLoginMode(false)} />
            ) : (
                <RegisterForm onSwitchMode={() => setIsLoginMode(true)} />
            )}
        </Card>
    );
};