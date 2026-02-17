import { AppConfig } from '../config/AppConfig';
import type { SentimentResult } from '../models/SentimentResult';

export const analysisService = {
    analyzeText: async (text: string): Promise<SentimentResult> => {
        const url = `${AppConfig.ApiBaseUrl}${AppConfig.Endpoints.Analysis}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            throw new Error(`Analysis failed: ${response.statusText}`);
        }

        return await response.json();
    }
};