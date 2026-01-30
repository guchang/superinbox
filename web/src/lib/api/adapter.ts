import type { Item, AIAnalysis, Entity } from '@/types'

/**
 * 后端数据格式
 */
interface BackendItem {
  id: string
  userId: string
  originalContent: string
  contentType: string
  source: string
  category: string
  entities: Record<string, any>
  summary: string | null
  suggestedTitle: string | null
  status: string
  distributedTargets: any[]
  distributionResults: any[]
  distributedRuleNames?: string[]
  routingStatus?: string
  createdAt: string
  updatedAt: string
  createdAtLocal?: string | null
  updatedAtLocal?: string | null
  processedAt?: string
}

/**
 * 将后端数据格式转换为前端期望的格式
 */
export function adaptBackendItem(backendItem: BackendItem): Item {
  // 构建 analysis 对象
  const analysis: AIAnalysis | undefined = backendItem.category
    ? {
        category: backendItem.category as any,
        confidence: 1.0, // 后端没有提供置信度，默认为 1.0
        entities: adaptEntities(backendItem.entities),
        summary: backendItem.summary || undefined,
      }
    : undefined

  // Extract file-related fields from entities
  const entities = backendItem.entities || {};
  const hasFile = !!(entities.filePath || entities.fileName);
  const fileName = entities.fileName as string | undefined;
  const mimeType = entities.mimeType as string | undefined;
  const fileSize = entities.fileSize as number | undefined;
  const filePath = entities.filePath as string | undefined;
  
  // Extract multiple files info
  const allFiles = entities.allFiles as Array<{
    fileName: string
    mimeType: string
    fileSize: number
    filePath: string
  }> | undefined;

  return {
    id: backendItem.id,
    content: backendItem.originalContent,
    contentType: backendItem.contentType as any,
    source: backendItem.source,
    status: backendItem.status as any,
    analysis,
    distributionResults: backendItem.distributionResults,
    distributedTargets: backendItem.distributedTargets,
    distributedRuleNames: backendItem.distributedRuleNames,
    routingStatus: backendItem.routingStatus as any,
    createdAt: backendItem.createdAt,
    updatedAt: backendItem.updatedAt,
    createdAtLocal: backendItem.createdAtLocal ?? null,
    updatedAtLocal: backendItem.updatedAtLocal ?? null,
    processedAt: backendItem.processedAt,
    // File related fields
    hasFile,
    fileName,
    mimeType,
    fileSize,
    filePath,
    allFiles,
  }
}

/**
 * 适配实体数据
 */
function formatEntityValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch (error) {
    return String(value)
  }
}

function adaptEntities(backendEntities?: Record<string, any> | null): Entity[] {
  const entities: Entity[] = []

  if (!backendEntities) {
    return entities
  }

  for (const [type, value] of Object.entries(backendEntities)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        const formatted = formatEntityValue(v)
        if (formatted) {
          entities.push({ type, value: formatted })
        }
      })
    } else {
      const formatted = formatEntityValue(value)
      if (formatted) {
        entities.push({ type, value: formatted })
      }
    }
  }

  return entities
}

/**
 * 适配条目列表
 */
export function adaptBackendItems(backendItems: BackendItem[]): Item[] {
  return backendItems.map(adaptBackendItem)
}
