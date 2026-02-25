import * as signalR from '@microsoft/signalr';
import { useMarketStore } from '../store/marketStore';
import { AppConfig } from '../config/AppConfig';
import { useNotificationStore } from '../store/notificationStore';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/authStore'; // ✨ 1. Import Auth Store

class SignalRService {
    private connection: signalR.HubConnection | null = null;
    
    private readonly hubUrl = `${AppConfig.ApiBaseUrl}${AppConfig.SignalR.HubPath}`;

    public async startConnection(): Promise<void> {
        // ✨ 2. CRITICAL: If we are logging in/out, cleanly stop the old anonymous connection first!
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            await this.connection.stop();
        }

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(this.hubUrl, {
                skipNegotiation: true,
                transport: signalR.HttpTransportType.WebSockets,
                // ✨ 3. THIS IS THE MISSING MAGIC LINE: Send the JWT token to .NET!
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

            // Instantly fetch the new crypto balance from the database!
            useWalletStore.getState().fetchWallet();
        });

        try {
            await this.connection.start();
            // Added a log so you can explicitly see if it connected as a logged-in user or anonymous
            const hasToken = !!useAuthStore.getState().token;
            console.log(`✅ SignalR Connected (Authenticated: ${hasToken})`);
        } catch (err) {
            console.error('SignalR Connection Error: ', err);
            setTimeout(() => this.startConnection(), 5000);
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