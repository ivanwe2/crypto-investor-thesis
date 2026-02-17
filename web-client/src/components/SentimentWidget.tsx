import { useState } from 'react';
import { analysisService } from '../services/analysisService';
import type { SentimentResult } from '../models/SentimentResult';

export const SentimentWidget = () => {
    const [text, setText] = useState('');
    const [result, setResult] = useState<SentimentResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        if (!text.trim()) return;
        
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const data = await analysisService.analyzeText(text);
            setResult(data);
        } catch (err) {
            console.error(err);
            setError('Failed to analyze sentiment. Is the AI service online?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={widgetStyle}>
            <h3>🤖 AI Market Analyst</h3>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste a news headline here (e.g., 'Bitcoin crashes due to regulation')..."
                style={inputStyle}
                rows={3}
            />
            
            <div style={{ marginTop: '10px' }}>
                <button 
                    onClick={handleAnalyze} 
                    disabled={loading || !text}
                    style={buttonStyle}
                >
                    {loading ? 'Thinking...' : 'Analyze Sentiment'}
                </button>
            </div>

            {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

            {result && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <strong>Verdict:</strong>
                        <span style={getBadgeStyle(result.label)}>
                            {result.label}
                        </span>
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '0.9rem', color: '#666' }}>
                        Confidence: {(result.score * 100).toFixed(1)}%
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#999' }}>
                        Model: {result.model_version}
                    </div>
                </div>
            )}
        </div>
    );
};

// Simple inline styles for MVP
const widgetStyle: React.CSSProperties = {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '1.5rem',
    backgroundColor: '#fff',
    height: 'fit-content'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    resize: 'vertical',
    fontFamily: 'inherit'
};

const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    opacity: 1
};

const getBadgeStyle = (label: string): React.CSSProperties => {
    const color = label === 'POSITIVE' ? 'green' : label === 'NEGATIVE' ? 'red' : 'gray';
    return {
        backgroundColor: color,
        color: 'white',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: 'bold'
    };
};