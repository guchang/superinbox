/**
 * API Statistics Type Definitions
 * Types for API usage statistics and analytics
 */

/**
 * Time range options for statistics queries
 */
export type StatisticsTimeRange = 'today' | 'week' | 'month' | 'all'

/**
 * Overall statistics summary
 */
export interface StatisticsSummary {
  totalRequests: number
  successCount: number
  errorCount: number
  successRate: number
  trendPercentage?: number // Percentage change from previous period
}

/**
 * Per-key statistics
 */
export interface KeyStatistics {
  id: string
  name: string
  requests: number
  successRate: number
  percentage: number // Percentage of total requests
  lastUsed: string // ISO timestamp
}

/**
 * Trend data point for charts
 */
export interface TrendDataPoint {
  date: string // Date in MM-DD format
  requests: number
}

/**
 * Status distribution
 */
export interface StatusDistribution {
  status: 'success' | 'error'
  count: number
  percentage: number
}

/**
 * Complete statistics response
 */
export interface StatisticsResponse {
  summary: StatisticsSummary
  keyStats: KeyStatistics[]
  trendData: TrendDataPoint[]
  statusDistribution: StatusDistribution[]
  timeRange: StatisticsTimeRange
  generatedAt: string
}

/**
 * Statistics query parameters
 */
export interface StatisticsQuery {
  timeRange: StatisticsTimeRange
  startDate?: string // ISO timestamp
  endDate?: string // ISO timestamp
}
