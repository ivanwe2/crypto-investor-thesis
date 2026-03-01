import { useState } from 'react';
import { Card, Textarea, Button, Text, Badge, Spinner, tokens } from '@fluentui/react-components';
import { BrainCircuit24Regular } from '@fluentui/react-icons';
import { analysisService } from '../services/analysisService';
import type { SentimentResult } from '../models/SentimentResult';
import styles from './SentimentWidget.module.scss';

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

    // Helper to map your API string to Fluent UI badge colors
    const getBadgeColor = (label: string) => {
        if (label === 'POSITIVE') return 'success';
        if (label === 'NEGATIVE') return 'danger';
        return 'warning';
    };

    return (
        <Card style={{ backgroundColor: tokens.colorNeutralBackground1Hover }}>
            <div className={styles.header}>
                <BrainCircuit24Regular />
                <Text size={500} weight="semibold">AI Market Analyst</Text>
            </div>

            <div className={styles.container}>
                <Textarea
                    value={text}
                    onChange={(_, data) => setText(data.value)}
                    placeholder="Paste a news headline here (e.g., 'Bitcoin crashes due to regulation')..."
                    rows={3}
                    resize="vertical"
                />
                
                <Button 
                    appearance="primary"
                    onClick={handleAnalyze} 
                    disabled={loading || !text}
                    icon={loading ? <Spinner size="tiny" /> : undefined}
                >
                    {loading ? 'Thinking...' : 'Analyze Sentiment'}
                </Button>

                {error && (
                    <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
                        {error}
                    </Text>
                )}

                {result && (
                    <div className={styles.resultBox} style={{ backgroundColor: tokens.colorNeutralBackground2 }}>
                        <div className={styles.resultHeader}>
                            <Text weight="semibold">Verdict:</Text>
                            <Badge appearance="filled" color={getBadgeColor(result.label)}>
                                {result.label}
                            </Badge>
                        </div>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                            Confidence: {(result.score * 100).toFixed(1)}%
                        </Text>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground4 }}>
                            Model: {result.model_version}
                        </Text>
                    </div>
                )}
            </div>
        </Card>
    );
};