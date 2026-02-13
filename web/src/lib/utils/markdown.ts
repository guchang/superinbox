/**
 * Markdown 内容规范化工具函数
 */

/**
 * 规范化 Markdown 内容，处理空白字符和换行符
 * @param value - 原始 Markdown 内容
 * @returns 规范化后的内容，如果内容只包含空白字符则返回空字符串
 */
export function normalizeMarkdownContent(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n')

  // TipTap/Markdown 在某些情况下会把"空内容"序列化成 `&nbsp;`（或 NBSP）。
  // 这会触发自动保存并让用户看到一串奇怪字符。
  // 这里把"只有空白/nbsp"的内容统一折叠为空字符串，避免脏数据写回。
  const blankProbe = normalized
    .replace(/&nbsp;|&#160;|\u00a0/gi, ' ')
    .trim()

  if (!blankProbe) return ''

  return normalized
}
