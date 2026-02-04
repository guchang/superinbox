import { apiClient } from './client';

export interface BatchRedistributeOptions {
  filter?: {
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  };
  batchSize?: number;
  delayBetweenBatches?: number;
}

export interface BatchRedistributeResponse {
  total: number;
  batchSize: number;
  estimatedBatches: number;
  estimatedDurationMinutes: number;
  message: string;
}

export interface BatchRedistributeStatus {
  total: number;
  success: number;
  failed: number;
  lastDistribution: string;
}

export async function batchRedistribute(
  options: BatchRedistributeOptions
): Promise<BatchRedistributeResponse> {
  const response = await apiClient.post<BatchRedistributeResponse>(
    '/inbox/batch-redistribute',
    options
  );
  return response.data!;
}

export async function getBatchRedistributeStatus(): Promise<BatchRedistributeStatus> {
  const response = await apiClient.get<BatchRedistributeStatus>(
    '/inbox/batch-redistribute/status'
  );
  return response.data!;
}
