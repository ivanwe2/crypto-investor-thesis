import * as signalR from '@microsoft/signalr';
import { useMarketStore } from '../hooks/useMarketStore';
import { AppConfig } from '../config/AppConfig';

class SignalRService {
    private connection: signalR.HubConnection | null = null;
    
    // Construct the full URL: http://localhost:5000/hubs/market
    private readonly hubUrl = `${AppConfig.ApiBaseUrl}${AppConfig.SignalR.HubPath}`;

    public async startConnection(): Promise<void> {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(this.hubUrl, {
                skipNegotiation: true,
                transport: signalR.HttpTransportType.WebSockets
            })
            .withAutomaticReconnect()
            .build();

        // Listen for the specific event defined in Config
        this.connection.on(AppConfig.SignalR.Events.ReceivePriceUpdate, (data: any) => {
            useMarketStore.getState().updateTicker(data);
        });

        try {
            await this.connection.start();
            console.log(`SignalR Connected to ${this.hubUrl}`);
        } catch (err) {
            console.error('SignalR Connection Error: ', err);
            setTimeout(() => this.startConnection(), 5000);
        }
    }

    public async joinGroup(symbol: string): Promise<void> {
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            try {
                // Call the Backend method defined in Config
                await this.connection.invoke(AppConfig.SignalR.Methods.JoinGroup, symbol);
            } catch (err) {
                console.error(`Failed to join group ${symbol}:`, err);
            }
        }
    }
}

export const signalRService = new SignalRService();