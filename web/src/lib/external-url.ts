const HTTP_PROTOCOL_PATTERN = /^https?:\/\//i
const MAILTO_PROTOCOL_PATTERN = /^mailto:/i
const TEL_PROTOCOL_PATTERN = /^tel:/i
const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#][^\s]*)?$/i
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

function normalizeHttpOrDomain(value: string): string | null {
  const candidate = HTTP_PROTOCOL_PATTERN.test(value)
    ? value
    : DOMAIN_PATTERN.test(value)
      ? `https://${value}`
      : null

  if (!candidate) return null

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.href
  } catch {
    return null
  }
}

function normalizeMailto(value: string): string | null {
  const address = MAILTO_PROTOCOL_PATTERN.test(value)
    ? value.replace(MAILTO_PROTOCOL_PATTERN, '').trim()
    : value

  if (!EMAIL_PATTERN.test(address)) return null
  return `mailto:${address}`
}

function normalizeTel(value: string): string | null {
  const rawPhone = TEL_PROTOCOL_PATTERN.test(value)
    ? value.replace(TEL_PROTOCOL_PATTERN, '').trim()
    : value

  const compactPhone = rawPhone.replace(/[\s().-]/g, '')
  if (!/^\+?\d{6,15}$/.test(compactPhone)) return null

  const hasPlus = compactPhone.startsWith('+')
  const digits = compactPhone.replace(/\D/g, '')
  return `tel:${hasPlus ? '+' : ''}${digits}`
}

export function normalizeExternalUrl(value: string): string | null {
  const trimmedValue = value.trim()
  if (!trimmedValue) return null

  return (
    normalizeHttpOrDomain(trimmedValue) ||
    normalizeMailto(trimmedValue) ||
    normalizeTel(trimmedValue)
  )
}

export function isLikelyExternalUrl(value: string): boolean {
  return normalizeExternalUrl(value) !== null
}

export function shouldOpenInNewTab(href: string): boolean {
  return HTTP_PROTOCOL_PATTERN.test(href)
}
