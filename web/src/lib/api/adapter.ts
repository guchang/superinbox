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
  priority: string
  distributedTargets: any[]
  distributionResults: any[]
  createdAt: string
  updatedAt: string
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
    priority: backendItem.priority as any,
    analysis,
    distributionResults: backendItem.distributionResults,
    createdAt: backendItem.createdAt,
    updatedAt: backendItem.updatedAt,
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
function adaptEntities(backendEntities?: Record<string, any> | null): Entity[] {
  const entities: Entity[] = []

  if (!backendEntities) {
    return entities
  }

  for (const [type, value] of Object.entries(backendEntities)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        entities.push({ type, value: String(v) })
      })
    } else {
      entities.push({ type, value: String(value) })
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
