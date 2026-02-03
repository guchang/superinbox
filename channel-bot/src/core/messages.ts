export type LanguageCode = 'en' | 'zh';

type MessageKey =
  | 'bindingAlready'
  | 'bindingPrompt'
  | 'usageBind'
  | 'invalidApiKey'
  | 'bindingSuccess'
  | 'pleaseBind'
  | 'noApiKeyBound'
  | 'failedReadFile'
  | 'fileTooLarge'
  | 'tooManyFiles'
  | 'unsupportedFileType'
  | 'addedToInbox'
  | 'errorProcessing'
  | 'uploadFailed'
  | 'helpText'
  | 'langUsage'
  | 'langInvalid'
  | 'langSet'
  | 'telegramFixedLang'
  | 'unknownMime'
  | 'aiCompletedTitle'
  | 'aiFailedTitle'
  | 'aiFailedBody'
  | 'categoryLabel'
  | 'summaryLabel'
  | 'confidenceLabel'
  | 'routingCompletedTitle'
  | 'routingFailedTitle'
  | 'routedToLabel'
  | 'resultsLabel'
  | 'successLabel'
  | 'failedLabel'
  | 'failedToSendSingle'
  | 'failedToSendMultiple'
  | 'errorLabel'
  | 'unknownError'
  | 'eventTitle'
  | 'listTitle'
  | 'listEmpty'
  | 'listItem'
  | 'listMoreItems'
  | 'listPageInfo'
  | 'listError'
  | 'listUsage';

const MESSAGES: Record<LanguageCode, Record<MessageKey, string>> = {
  en: {
    bindingAlready: 'Your account is already bound. Use /bind <API_KEY> to update.',
    bindingPrompt: 'Welcome! Please bind your account:\n/bind <API_KEY>',
    usageBind: 'Usage: /bind <API_KEY>',
    invalidApiKey: 'Invalid API key. Please try again.',
    bindingSuccess: '✅ Binding successful. You can now send messages.',
    pleaseBind: 'Please bind your account with /bind <API_KEY>.',
    noApiKeyBound: 'No API key bound. Use /bind <API_KEY> to bind.',
    failedReadFile: 'Failed to read file. Please try again.',
    fileTooLarge: 'File too large. Max {max}MB.',
    tooManyFiles: 'Too many files (images/videos/etc). Max {max}.',
    unsupportedFileType: 'Unsupported file type: {mime}',
    addedToInbox: '✅ Added to inbox',
    errorProcessing: '❌ Error: {message}',
    uploadFailed: '❌ {message}',
    helpText:
      'SuperInbox Bot Help 📚\n\n' +
      '/start - Bind your account\n' +
      '/bind <API_KEY> - Bind your account\n' +
      '/list [page] [limit] - View your inbox\n' +
      '/lang <en|zh> - Set language (Lark only)\n' +
      '/help - Show this help message\n\n' +
      'Just send any message and it will be forwarded to SuperInbox!',
    langUsage: 'Usage: /lang <en|zh>',
    langInvalid: 'Unsupported language. Use /lang <en|zh>.',
    langSet: '✅ Language set to {language}',
    telegramFixedLang: 'Telegram replies are fixed in English.',
    unknownMime: 'unknown',
    aiCompletedTitle: '🤖 AI Analysis Complete',
    aiFailedTitle: '❌ AI Analysis Failed',
    aiFailedBody: 'Please try again or contact support.',
    categoryLabel: 'Category',
    summaryLabel: 'Summary',
    confidenceLabel: 'Confidence',
    routingCompletedTitle: '✅ Routing Complete',
    routingFailedTitle: '❌ Routing Failed',
    routedToLabel: 'Routed to',
    resultsLabel: 'Results',
    successLabel: 'success',
    failedLabel: 'failed',
    failedToSendSingle: 'Failed to send to {target}',
    failedToSendMultiple: 'Failed to send to {count} targets:',
    errorLabel: 'Error',
    unknownError: 'Unknown error.',
    eventTitle: '📝 Event: {type}',
    listTitle: '📬 Inbox ({total} items)',
    listEmpty: '📬 Inbox is empty',
    listItem: '{index}. {content}\n   📌 {category} | {status} | {date}',
    listMoreItems: '... and {more} more items. Use /list {page} to see more.',
    listPageInfo: 'Page {page} of {totalPages}',
    listError: '❌ Failed to fetch inbox: {message}',
    listUsage: 'Usage: /list [page] [limit=10]\nExample: /list 1 10',
  },
  zh: {
    bindingAlready: '账号已绑定，可用 /bind <API_KEY> 更新。',
    bindingPrompt: '欢迎使用！请先绑定账号：\n/bind <API_KEY>',
    usageBind: '用法：/bind <API_KEY>',
    invalidApiKey: 'API key 无效，请重试。',
    bindingSuccess: '✅ 绑定成功，可以发送消息了。',
    pleaseBind: '请先用 /bind <API_KEY> 绑定账号。',
    noApiKeyBound: '未绑定 API key，请用 /bind <API_KEY> 绑定。',
    failedReadFile: '读取文件失败，请重试。',
    fileTooLarge: '文件过大，最大 {max}MB。',
    tooManyFiles: '文件（图片、视频等类型）数量过多，最多 {max} 个。',
    unsupportedFileType: '不支持的文件类型：{mime}',
    addedToInbox: '✅ 已加入收件箱',
    errorProcessing: '❌ 错误：{message}',
    uploadFailed: '❌ {message}',
    helpText:
      'SuperInbox 机器人帮助 📚\n\n' +
      '/start - 绑定账号\n' +
      '/bind <API_KEY> - 绑定账号\n' +
      '/list [页码] [数量] - 查看收件箱\n' +
      '/lang <en|zh> - 设置语言（仅飞书）\n' +
      '/help - 显示此帮助信息\n\n' +
      '直接发送任意消息即可转发到 SuperInbox！',
    langUsage: '用法：/lang <en|zh>',
    langInvalid: '不支持的语言，请用 /lang <en|zh>。',
    langSet: '✅ 已切换为{language}',
    telegramFixedLang: 'Telegram 回复固定英文。',
    unknownMime: '未知',
    aiCompletedTitle: '🤖 AI 分析完成',
    aiFailedTitle: '❌ AI 分析失败',
    aiFailedBody: '请稍后重试或联系支持。',
    categoryLabel: '分类',
    summaryLabel: '摘要',
    confidenceLabel: '置信度',
    routingCompletedTitle: '✅ 分发完成',
    routingFailedTitle: '❌ 分发失败',
    routedToLabel: '已分发到',
    resultsLabel: '结果',
    successLabel: '成功',
    failedLabel: '失败',
    failedToSendSingle: '发送到 {target} 失败',
    failedToSendMultiple: '发送到 {count} 个目标失败：',
    errorLabel: '错误',
    unknownError: '未知错误。',
    eventTitle: '📝 事件：{type}',
    listTitle: '📬 收件箱（共 {total} 条）',
    listEmpty: '📬 收件箱为空',
    listItem: '{index}. {content}\n   📌 {category} | {status} | {date}',
    listMoreItems: '... 还有 {more} 条。使用 /list {page} 查看更多。',
    listPageInfo: '第 {page}/{totalPages} 页',
    listError: '❌ 获取收件箱失败：{message}',
    listUsage: '用法：/list [页码] [数量=10]\n示例：/list 1 10',
  },
};

export function normalizeLanguage(input?: string | null): LanguageCode | null {
  if (!input) return null;
  const value = input.toLowerCase();
  if (value === 'en' || value === 'english') return 'en';
  if (value === 'zh' || value === 'cn' || value === 'chinese') return 'zh';
  return null;
}

export function getMessage(
  language: LanguageCode,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const template = MESSAGES[language][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      return String(params[name]);
    }
    return match;
  });
}
