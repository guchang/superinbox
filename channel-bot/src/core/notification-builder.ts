/**
 * Notification Message Builder
 *
 * Builds notification messages for different event types.
 */

import type { SSEEvent } from './sse-subscription.service.js';
import { getMessage, type LanguageCode } from './messages.js';

/**
 * Notification message with target channel
 */
export interface NotificationMessage {
  channelId: string;
  message: string;
}

/**
 * Build notification message for SSE event
 */
export function buildNotificationMessage(
  event: SSEEvent & { channelId: string },
  language: LanguageCode
): string {
  const { type, data } = event;

  switch (type) {
    case 'ai.completed':
      return appendItemIdSuffix(buildAICompletedMessage(data, language), event.itemId);

    case 'ai.failed':
      return appendItemIdSuffix(buildAIFailedMessage(language), event.itemId);

    case 'routing.completed':
      return appendItemIdSuffix(buildRoutingCompletedMessage(data, language), event.itemId);

    case 'routing.failed':
      return appendItemIdSuffix(buildRoutingFailedMessage(data, language), event.itemId);

    default:
      return appendItemIdSuffix(getMessage(language, 'eventTitle', { type }), event.itemId);
  }
}

/**
 * Build AI completed message
 */
function buildAICompletedMessage(data: SSEEvent['data'], language: LanguageCode): string {
  const category = data.category || 'unknown';
  const summary = data.summary;
  const confidence = data.confidence;

  let message = `${getMessage(language, 'aiCompletedTitle')}\n\n`;

  message += `${getMessage(language, 'categoryLabel')}: ${formatCategory(category, language)}\n`;

  if (summary) {
    message += `\n${getMessage(language, 'summaryLabel')}: ${summary}`;
  }

  if (confidence !== undefined) {
    const confidencePercent = Math.round(confidence * 100);
    message += `\n${getMessage(language, 'confidenceLabel')}: ${confidencePercent}%`;
  }

  return message;
}

/**
 * Build routing completed message
 */
function buildRoutingCompletedMessage(data: SSEEvent['data'], language: LanguageCode): string {
  // Backend sends different data format
  const ruleNames = (data as any).ruleNames || [];
  const totalSuccess = (data as any).totalSuccess || 0;
  const totalFailed = (data as any).totalFailed || 0;

  let result = `${getMessage(language, 'routingCompletedTitle')}\n\n`;

  if (ruleNames.length > 0) {
    result += `${getMessage(language, 'routedToLabel')}:\n`;
    ruleNames.forEach((rule: string, index: number) => {
      result += `  ${index + 1}. ${rule}\n`;
    });
  }

  if (totalSuccess > 0 || totalFailed > 0) {
    result += `\n${getMessage(language, 'resultsLabel')}: ${totalSuccess} ${getMessage(language, 'successLabel')}, ${totalFailed} ${getMessage(language, 'failedLabel')}`;
  }

  return result.trim();
}

/**
 * Build routing failed message
 */
function buildRoutingFailedMessage(data: SSEEvent['data'], language: LanguageCode): string {
  const failures = data.failures || [];
  const messageText = (data as any).message as string | undefined;
  const errorText = (data as any).error as string | undefined;

  let message = `${getMessage(language, 'routingFailedTitle')}\n\n`;

  if (failures.length === 0) {
    if (messageText) {
      message += `${messageText}\n`;
    }
    if (errorText) {
      message += `${getMessage(language, 'errorLabel')}: ${errorText}`;
    }
    if (!messageText && !errorText) {
      message += getMessage(language, 'unknownError');
    }
  } else if (failures.length === 1) {
    message += `${getMessage(language, 'failedToSendSingle', {
      target: formatTargetName(failures[0].target),
    })}\n`;
    message += `${getMessage(language, 'errorLabel')}: ${failures[0].error}`;
  } else {
    message += `${getMessage(language, 'failedToSendMultiple', { count: failures.length })}\n`;
    failures.forEach((failure, index) => {
      message += `  ${index + 1}. ${formatTargetName(failure.target)}\n`;
      message += `     ${getMessage(language, 'errorLabel')}: ${failure.error}\n`;
    });
  }

  return message.trim();
}

/**
 * Build AI failed message
 */
function buildAIFailedMessage(language: LanguageCode): string {
  return `${getMessage(language, 'aiFailedTitle')}\n\n${getMessage(language, 'aiFailedBody')}`;
}

/**
 * Format category name to readable text
 */
function formatCategory(category: string, language: LanguageCode): string {
  const categoryMap: Record<string, Record<string, string>> = {
    en: {
      todo: '📋 Todo',
      idea: '💡 Idea',
      expense: '💰 Expense',
      note: '📝 Note',
      bookmark: '🔖 Bookmark',
      schedule: '📅 Schedule',
      unknown: '❓ Unknown',
    },
    zh: {
      todo: '📋 待办',
      idea: '💡 想法',
      expense: '💰 支出',
      note: '📝 笔记',
      bookmark: '🔖 书签',
      schedule: '📅 日程',
      unknown: '❓ 未知',
    },
  };

  const map = categoryMap[language] || categoryMap.en;
  if (map[category]) {
    return map[category];
  }

  return `📁 ${category}`;
}

/**
 * Format target name to readable text
 */
function formatTargetName(target: string): string {
  // MCP adapter targets usually have format like "mcp_notion_xxx"
  if (target.startsWith('mcp_')) {
    const parts = target.split('_');
    if (parts[1]) {
      return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    }
  }

  return target;
}

function appendItemIdSuffix(message: string, itemId?: string): string {
  if (!itemId || itemId.length < 4) return message;
  const suffix = ` (ID:${itemId.slice(-4)})`;
  const [firstLine, ...rest] = message.split('\n');
  return [firstLine + suffix, ...rest].join('\n');
}
