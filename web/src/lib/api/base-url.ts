export function getApiBaseUrl(): string {
  // 使用相对路径，通过 Next.js 代理转发
  // 注意：SSE 需要绕过代理直接连接后端（因为代理不支持长连接）
  return '/v1'
}

// 获取后端直接URL（用于SSE等需要绕过代理的场景）
export function getBackendDirectUrl(): string {
  // 优先使用环境变量，否则使用默认值
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace('/v1', '')
  }

  // 浏览器环境
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const host = window.location.hostname
    const port = 3001  // Backend runs on port 3001
    return `${protocol}//${host}:${port}`
  }

  // 服务器端或默认
  return 'http://localhost:3001'
}
