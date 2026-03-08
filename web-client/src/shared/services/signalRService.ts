import * as signalR from '@microsoft/signalr';
import { useMarketStore } from '../../features/market/store/marketStore';
import { AppConfig } from '../config/AppConfig';
import { useNotificationStore } from '../store/notificationStore';
import { useWalletStore } from '../../features/portfolio/store/walletStore';
import { useAuthStore } from '../../features/auth/store/authStore';

class SignalRService {
    private connection: signalR.HubConnection | null = null;
    private isConnecting = false;
    private readonly hubUrl = `${AppConfig.ApiBaseUrl}${AppConfig.SignalR.HubPath}`;

    public async startConnection(): Promise<void> {
        // ✨ 1. If we are currently in the middle of connecting, ignore duplicate requests
        if (this.isConnecting) return;

        // ✨ 2. If we are already connected, DO NOT drop the connection! 
        // This makes adding coins to the watchlist lightning fast.
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            return;
        }

        this.isConnecting = true;

        try {
            if (this.connection) {
                await this.connection.stop();
            }

            this.connection = new signalR.HubConnectionBuilder()
                .withUrl(this.hubUrl, {
                    skipNegotiation: true,
                    transport: signalR.HttpTransportType.WebSockets,
                    accessTokenFactory: () => useAuthStore.getState().token || ''
                })
                .withAutomaticReconnect()
                .build();

            this.connection.on(AppConfig.SignalR.Events.ReceivePriceUpdate, (data: any) => {
                useMarketStore.getState().updateTicker(data);
            });

            this.connection.on(AppConfig.SignalR.Events.OrderFilled, (data: { symbol: string, quantity: number, price: number }) => {
                console.log("🔥 Order Filled Event Received from SignalR:", data);
                
                const message = `Order Executed! Bought ${data.quantity} ${data.symbol} at $${data.price.toLocaleString()}`;
                useNotificationStore.getState().addNotification(message, 'success');

                useWalletStore.getState().fetchWallet();
            });

            this.connection.on("ReceiveAiSignal", (data: { symbol: string, signal: string, confidence: number, reason: string }) => {
                console.log("🤖 AI Signal Received:", data);
                
                const confidencePercent = (data.confidence * 100).toFixed(0);
                const message = `🤖 AI Alert: ${data.symbol} is ${data.signal} (${confidencePercent}%)\n\n${data.reason}`;
                
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

    public async joinGroup(symbol: string): Promise<void> {
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            try {
                await this.connection.invoke(AppConfig.SignalR.Methods.JoinGroup, symbol);
            } catch (err) {
                console.error(`Failed to join group ${symbol}:`, err);
            }
        }
    }
}

export const signalRService = new SignalRService();