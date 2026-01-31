/**
 * Notification Message Builder
 *
 * Builds notification messages for different event types.
 */

import type { SSEEvent } from './sse-subscription.service.js';

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
export function buildNotificationMessage(event: SSEEvent & { channelId: string }): string {
  const { type, data } = event;

  switch (type) {
    case 'ai.completed':
      return buildAICompletedMessage(data);

    case 'ai.failed':
      return buildAIFailedMessage();

    case 'routing.completed':
      return buildRoutingCompletedMessage(data);

    case 'routing.failed':
      return buildRoutingFailedMessage(data);

    default:
      return `📝 Event: ${type}`;
  }
}

/**
 * Build AI completed message
 */
function buildAICompletedMessage(data: SSEEvent['data']): string {
  const category = data.category || 'unknown';
  const summary = data.summary;
  const confidence = data.confidence;

  let message = `🤖 AI Analysis Complete\n\n`;

  message += `Category: ${formatCategory(category)}\n`;

  if (summary) {
    message += `\nSummary: ${summary}`;
  }

  if (confidence !== undefined) {
    const confidencePercent = Math.round(confidence * 100);
    message += `\nConfidence: ${confidencePercent}%`;
  }

  return message;
}

/**
 * Build routing completed message
 */
function buildRoutingCompletedMessage(data: SSEEvent['data']): string {
  // Backend sends different data format
  const ruleNames = (data as any).ruleNames || [];
  const totalSuccess = (data as any).totalSuccess || 0;
  const totalFailed = (data as any).totalFailed || 0;

  let result = `✅ Routing Complete\n\n`;

  if (ruleNames.length > 0) {
    result += `Routed to:\n`;
    ruleNames.forEach((rule: string, index: number) => {
      result += `  ${index + 1}. ${rule}\n`;
    });
  }

  if (totalSuccess > 0 || totalFailed > 0) {
    result += `\nResults: ${totalSuccess} success, ${totalFailed} failed`;
  }

  return result.trim();
}

/**
 * Build routing failed message
 */
function buildRoutingFailedMessage(data: SSEEvent['data']): string {
  const failures = data.failures || [];
  const messageText = (data as any).message as string | undefined;
  const errorText = (data as any).error as string | undefined;

  let message = `❌ Routing Failed\n\n`;

  if (failures.length === 0) {
    if (messageText) {
      message += `${messageText}\n`;
    }
    if (errorText) {
      message += `Error: ${errorText}`;
    }
    if (!messageText && !errorText) {
      message += `Unknown error.`;
    }
  } else if (failures.length === 1) {
    message += `Failed to send to ${formatTargetName(failures[0].target)}\n`;
    message += `Error: ${failures[0].error}`;
  } else {
    message += `Failed to send to ${failures.length} targets:\n`;
    failures.forEach((failure, index) => {
      message += `  ${index + 1}. ${formatTargetName(failure.target)}\n`;
      message += `     Error: ${failure.error}\n`;
    });
  }

  return message.trim();
}

/**
 * Build AI failed message
 */
function buildAIFailedMessage(): string {
  return `❌ AI Analysis Failed\n\nPlease try again or contact support.`;
}

/**
 * Format category name to readable text
 */
function formatCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    'todo': '📋 Todo',
    'idea': '💡 Idea',
    'expense': '💰 Expense',
    'note': '📝 Note',
    'bookmark': '🔖 Bookmark',
    'schedule': '📅 Schedule',
    'unknown': '❓ Unknown',
  };

  return categoryMap[category] || `📁 ${category}`;
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
