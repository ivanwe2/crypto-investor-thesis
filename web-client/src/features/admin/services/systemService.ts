import { apiClient } from "../../../shared/services/apiClient";
import { AppConfig } from "../../../shared/config/AppConfig";

export interface SystemHealthResponse {
  status: string;
  uptime: string;
  responseTimeMs: number;
  components: {
    postgreSQL: string;
    redisReadModel: string;
    goMarketGateway: string;
    aiCircuitBreaker: string;
    activeSignalRConnections: number;
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
