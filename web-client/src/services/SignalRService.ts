import * as signalR from '@microsoft/signalr';
import { useMarketStore } from '../store/marketStore';
import { AppConfig } from '../config/AppConfig';

class SignalRService {
    private connection: signalR.HubConnection | null = null;
    
    private readonly hubUrl = `${AppConfig.ApiBaseUrl}${AppConfig.SignalR.HubPath}`;

    public async startConnection(): Promise<void> {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(this.hubUrl, {
                skipNegotiation: true,
                transport: signalR.HttpTransportType.WebSockets
            })
            .withAutomaticReconnect()
            .build();

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