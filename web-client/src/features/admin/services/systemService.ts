import { apiClient } from "../../../shared/services/apiClient";
import { AppConfig } from "../../../shared/config/AppConfig";

export interface SystemHealthResponse {
  status: string;
  uptime: string;
  responseTimeMs: number;
  infrastructure: {
    postgreSQL: string;
    redis: string;
    rabbitMQ: string;
    rabbitMqTradeEventsQueueDepth: number;
    aiAnalyst: string;
    aiCircuitBreaker: string;
  };
  dotNetMetrics: {
    activeSignalRConnections: number;
    memoryWorkingSetMb: number;
    garbageCollectionAllocatedMb: number;
    availableWorkerThreads: number;
  };
  goGatewayMetrics: {
    goroutines: number;
    memoryAllocMb: number;
    memorySysMb: number;
    status: string;
  };
}

export const systemService = {
  getHealth: async (): Promise<SystemHealthResponse> => {
    const response = await apiClient.get<SystemHealthResponse>(
      AppConfig.Endpoints.SystemHealth,
    );
    return response.data;
  },
};