import { useState } from 'react';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export const AuthWidget = () => {
    const { username, login, logout, isAuthenticated } = useAuthStore();

    const [isLoginMode, setIsLoginMode] = useState(true);
    const [formUsername, setFormUsername] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const request = { username: formUsername, password: formPassword };
            const response = isLoginMode 
                ? await authService.login(request)
                : await authService.register(request);

            login(response.token, response.username, response.userId);
            
            setFormUsername('');
            setFormPassword('');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (isAuthenticated()) {
        return (
            <div style={widgetStyle}>
                <h3>👤 Account</h3>
                <p>Welcome back, <strong>{username}</strong>!</p>
                {/* We will add Wallet Balance here in the next step! */}
                <button onClick={logout} style={logoutButtonStyle}>
                    Log Out
                </button>
            </div>
        );
    }

    return (
        <div style={widgetStyle}>
            <h3>{isLoginMode ? '🔑 Login' : '📝 Register'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Username"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    style={inputStyle}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    style={inputStyle}
                    required
                />
                
                {error && <div style={{ color: 'red', fontSize: '0.85rem' }}>{error}</div>}

                <button type="submit" disabled={loading} style={buttonStyle}>
                    {loading ? 'Processing...' : (isLoginMode ? 'Log In' : 'Create Account')}
                </button>
            </form>

            <div style={{ marginTop: '10px', fontSize: '0.85rem', textAlign: 'center' }}>
                {isLoginMode ? "Don't have an account? " : "Already have an account? "}
                <button 
                    type="button" 
                    onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }}
                    style={linkButtonStyle}
                >
                    {isLoginMode ? 'Register here' : 'Log in here'}
                </button>
            </div>
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

const inputStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    width: '100%',
    boxSizing: 'border-box'
};

const buttonStyle: React.CSSProperties = {
    padding: '10px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
};

const logoutButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#dc3545',
    marginTop: '10px'
};

const linkButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#007bff',
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: 0
};