export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const host = window.location.hostname
    const port = 3001
    return `${protocol}//${host}:${port}/v1`
  }

  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1'
}
