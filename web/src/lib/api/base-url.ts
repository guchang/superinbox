export function getApiBaseUrl(): string {
  // 使用相对路径，通过 Next.js 代理转发
  return '/v1'
}

// 获取后端直接URL（用于需要绕过代理的场景，如流式响应）
export function getBackendDirectUrl(): string {
  // 优先使用环境变量（生产环境一般会配置成 https://domain/v1）
  // 但开发环境 next.config.mjs 默认会把 NEXT_PUBLIC_API_URL 设成 http://localhost:3000/v1，
  // 这指向的是 Next 服务器本身（走 rewrites 代理），对 SSE/流式响应会发生缓冲导致“卡死”。
  // 因此遇到 localhost/127.0.0.1:3000 时，必须忽略该配置并直连 backend:3001。
  const configured = process.env.NEXT_PUBLIC_API_URL
  if (configured) {
    try {
      const url = new URL(configured)
      const isNextDevProxy =
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        url.port === '3000'

      if (!isNextDevProxy) {
        return url.origin
      }
    } catch {
      // ignore invalid URL and fall back to browser-derived host below
    }
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
