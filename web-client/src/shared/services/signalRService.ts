import * as signalR from '@microsoft/signalr';
import { useMarketStore } from '../../features/market/store/marketStore';
import { AppConfig } from '../config/AppConfig';
import { useNotificationStore } from '../store/notificationStore';
import { useWalletStore } from '../../features/portfolio/store/walletStore';
import { useAuthStore } from '../../features/auth/store/authStore';
import { useAiSignalsStore } from '../../features/ai/store/aiSignalsStore';

class SignalRService {
    private connection: signalR.HubConnection | null = null;
    private isConnecting = false;
    private currentToken: string | null = null;
    private readonly hubUrl = `${AppConfig.ApiBaseUrl}${AppConfig.SignalR.HubPath}`;

    private priceBuffer: Record<string, any> = {};
    
    private bufferIntervalId: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.startBufferFlush();
    }

    private startBufferFlush() {
        if (!this.bufferIntervalId) {
            this.bufferIntervalId = setInterval(() => {
                if (Object.keys(this.priceBuffer).length > 0) {
                    useMarketStore.getState().updateTickersBatch(this.priceBuffer);
                    this.priceBuffer = {}; 
                }
            }, 100);
        }
    }

    private stopBufferFlush() {
        if (this.bufferIntervalId) {
            clearInterval(this.bufferIntervalId);
            this.bufferIntervalId = null;
        }
    }

    public async startConnection(): Promise<void> {
        if (this.isConnecting) return;

        const newToken = useAuthStore.getState().token;

        if (this.connection?.state === signalR.HubConnectionState.Connected && this.currentToken === newToken) {
            return;
        }

        this.isConnecting = true;
        this.currentToken = newToken;

        try {
            if (this.connection) {
                await this.connection.stop();
            }

            this.startBufferFlush();

            this.connection = new signalR.HubConnectionBuilder()
                .withUrl(this.hubUrl, {
                    skipNegotiation: true,
                    transport: signalR.HttpTransportType.WebSockets,
                    accessTokenFactory: () => useAuthStore.getState().token || ''
                })
                .withAutomaticReconnect()
                .build();

            this.connection.on(AppConfig.SignalR.Events.ReceivePriceUpdate, (data: any) => {
                this.priceBuffer[data.s] = data; 
            });

            this.connection.on(AppConfig.SignalR.Events.OrderFilled, (data: { symbol: string, quantity: number, price: number, side: string }) => {
                console.log("🔥 Order Filled Event Received from SignalR:", data);

                const action = data.side === 'Sell' ? 'Sold' : 'Bought';
                const message = `Order Executed! ${action} ${data.quantity} ${data.symbol} at $${data.price.toLocaleString()}`;
                useNotificationStore.getState().addNotification(message, data.side === 'Sell' ? 'info' : 'success');

                useWalletStore.getState().fetchWallet();
            });

            this.connection.on("ReceiveAiSignal", (data: { symbol: string, signal: string, confidence: number, reason: string, side: string, timestamp: string }) => {
                console.log("🤖 AI Signal Received:", data);

                useAiSignalsStore.getState().addSignal({
                    symbol: data.symbol,
                    signal: data.signal as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
                    confidence: data.confidence,
                    reason: data.reason,
                    side: data.side,
                    timestamp: data.timestamp,
                });

                const icon = data.signal === 'BULLISH' ? '↑' : data.signal === 'BEARISH' ? '↓' : '→';
                const confidencePercent = (data.confidence * 100).toFixed(0);
                const message = `AI ${icon} ${data.symbol} ${data.signal} (${confidencePercent}%)\n${data.reason}`;
                useNotificationStore.getState().addNotification(message, 'ai');
            });

            await this.connection.start();
            const hasToken = !!useAuthStore.getState().token;
            console.log(`✅ SignalR Connected (Authenticated: ${hasToken})`);
        } catch (err) {
            console.error('SignalR Connection Error: ', err);
            setTimeout(() => {
                this.isConnecting = false;
                this.startConnection();
            }, 5000);
        } finally {
            this.isConnecting = false;
        }
    }

    public async stopConnection(): Promise<void> {
        this.stopBufferFlush();
        
        if (this.connection) {
            await this.connection.stop();
        }
        
        this.isConnecting = false;
        this.currentToken = null;
        console.log("🛑 SignalR Disconnected and Buffer Cleared.");
    }

    public async joinGroup(symbol: string): Promise<void> {
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            try {
                await this.connection.invoke(AppConfig.SignalR.Methods.JoinGroup, symbol);
            } catch (err) {
                console.error(`Failed to join group ${symbol}:`, err);
            }
        }
    }

    public async leaveGroup(symbol: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('LeaveMarketGroup', symbol);
      } catch (err) {
        console.error(`Failed to leave group ${symbol}:`, err);
      }
    }
  }
}

export const signalRService = new SignalRService();