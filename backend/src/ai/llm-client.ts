/**
 * LLM Client - Direct API Integration
 */

import axios, { type AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import type { LLMConfig } from '../types/index.js';
import { getDatabase } from '../storage/database.js';

const DEFAULT_LLM_TIMEOUT = 30000;
const DEFAULT_LLM_MAX_TOKENS = 2000;

const normalizeOpenAiCompatibleBaseUrl = (input?: string): string | undefined => {
  const raw = input?.trim();
  if (!raw) return undefined;

  // Some users paste the full endpoint; axios baseURL should be the API root.
  // e.g. "https://api.deepseek.com/v1/chat/completions" -> "https://api.deepseek.com/v1"
  let cleaned = raw.replace(/\/chat\/completions\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');

  try {
    const url = new URL(cleaned);
    const pathname = url.pathname.replace(/\/+$/, '');

    // If the user provided only origin (no path), default to OpenAI-compatible "/v1".
    if (pathname === '' || pathname === '/') {
      url.pathname = '/v1';
    } else {
      url.pathname = pathname;
    }

    // URL.toString() is stable and keeps scheme/host/port; remove any trailing slash.
    return url.toString().replace(/\/+$/, '');
  } catch {
    // If it's not a valid URL (e.g. missing scheme), return the cleaned value as-is.
    return cleaned;
  }
};

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  finishReason?: string;
  maxTokens: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  sessionId?: string;
  sessionType?: string;
}

interface LLMClientEntry {
  config: LLMConfig;
  provider: string;
  client: AxiosInstance;
}

const normalizeRuntimeLlmConfig = (raw: {
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  timeout: number | null;
  maxTokens: number | null;
}): LLMConfig | null => {
  const provider = raw.provider?.trim();
  const model = raw.model?.trim();
  const apiKey = raw.apiKey?.trim();

  if (!provider || !model || !apiKey) {
    return null;
  }

  const baseUrl = raw.baseUrl?.trim();

  return {
    provider,
    model,
    apiKey,
    baseUrl: baseUrl && baseUrl.length > 0 ? baseUrl : undefined,
    timeout: raw.timeout ?? DEFAULT_LLM_TIMEOUT,
    maxTokens: raw.maxTokens ?? DEFAULT_LLM_MAX_TOKENS,
  };
};

export class LLMClient {
  private entries: LLMClientEntry[];
  private userId?: string;
  private lastSuccessfulEntryIndex = 0;

  constructor(llmConfigs: LLMConfig | LLMConfig[], options?: { userId?: string }) {
    const configs = Array.isArray(llmConfigs) ? llmConfigs : [llmConfigs];
    if (configs.length === 0) {
      throw new Error('At least one LLM config is required');
    }

    this.entries = configs.map((cfg) => {
      const provider = cfg.provider || 'openai';
      const normalizedBaseUrl = normalizeOpenAiCompatibleBaseUrl(cfg.baseUrl);
      const normalizedConfig: LLMConfig = {
        ...cfg,
        baseUrl: normalizedBaseUrl ?? cfg.baseUrl,
      };
      return {
        config: normalizedConfig,
        provider,
        client: axios.create({
          baseURL: normalizedBaseUrl ?? 'https://api.openai.com/v1',
          headers: {
            'Authorization': `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: cfg.timeout
        })
      };
    });

    this.userId = options?.userId;
  }

  /**
   * Estimate token count from messages (fallback when API doesn't return usage)
   * Rough estimate: ~4 characters per token for English, more for Chinese
   */
  private estimateTokens(messages: LLMMessage[]): number {
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4);
  }

  /**
   * Log LLM usage asynchronously (non-blocking)
   */
  private logLlmUsage(
    entry: LLMClientEntry,
    messages: LLMMessage[],
    response: LLMResponse | null,
    error: Error | null,
    options?: {
      userId?: string;
      sessionId?: string;
      sessionType?: string;
    }
  ): void {
    setImmediate(() => {
      try {
        const db = getDatabase();
        db.createLlmUsageLog({
          id: randomUUID(),
          userId: options?.userId ?? this.userId,
          model: entry.config.model,
          provider: entry.provider,
          requestMessages: JSON.stringify(messages),
          responseContent: response?.content ?? undefined,
          promptTokens: response?.usage?.promptTokens ?? 0,
          completionTokens: response?.usage?.completionTokens ?? 0,
          totalTokens: response?.usage?.totalTokens ?? 0,
          status: error ? 'error' : 'success',
          errorMessage: error?.message ?? undefined,
          sessionId: options?.sessionId ?? undefined,
          sessionType: options?.sessionType ?? undefined,
        });
      } catch (logError) {
        console.error('[LLM] Failed to log usage:', logError);
      }
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const code = error.code;

      return status === 429 ||
             (status !== undefined && status >= 500 && status < 600) ||
             code === 'ECONNABORTED' ||
             code === 'ECONNRESET' ||
             code === 'ETIMEDOUT' ||
             error.message?.includes('timeout');
    }
    return false;
  }

  private async executeChatRequest(
    entry: LLMClientEntry,
    requestBody: any,
    messages: LLMMessage[],
    chatOptions: any,
    userId?: string
  ): Promise<LLMResponse> {
    const response = await entry.client.post('/chat/completions', requestBody);

    const choice = response.data.choices[0];
    const maxTokensUsed = requestBody.max_tokens;
    const result: LLMResponse = {
      content: choice.message.content || '',
      finishReason: choice.finish_reason,
      maxTokens: maxTokensUsed,
      usage: {
        promptTokens: response.data.usage?.prompt_tokens ?? 0,
        completionTokens: response.data.usage?.completion_tokens ?? 0,
        totalTokens: response.data.usage?.total_tokens ?? 0
      }
    };

    this.logLlmUsage(entry, messages, result, null, {
      userId: userId ?? this.userId,
      sessionId: chatOptions?.sessionId,
      sessionType: chatOptions?.sessionType
    });

    return result;
  }

  private async chatWithEntry(
    entry: LLMClientEntry,
    messages: LLMMessage[],
    options?: ChatOptions & { userId?: string }
  ): Promise<LLMResponse> {
    const { userId, ...chatOptions } = options ?? {};
    const sessionId = chatOptions?.sessionId ?? randomUUID();
    const sessionType = chatOptions?.sessionType ?? 'general';
    const normalizedChatOptions = { ...chatOptions, sessionId, sessionType };

    const requestBody: any = {
      model: entry.config.model,
      messages,
      temperature: chatOptions?.temperature ?? 0.3,
      max_tokens: chatOptions?.maxTokens ?? entry.config.maxTokens ?? DEFAULT_LLM_MAX_TOKENS
    };

    const baseUrl = entry.config.baseUrl ?? '';
    const modelName = entry.config.model ?? '';
    const supportsJsonMode = !baseUrl.includes('api.nvidia.com') &&
                            !modelName.includes('gpt-oss') &&
                            !modelName.includes('nvidia');
    if (chatOptions?.jsonMode && supportsJsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeChatRequest(entry, requestBody, messages, normalizedChatOptions, userId);
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryableError(error) || attempt === maxRetries) {
          break;
        }

        const isRateLimit = axios.isAxiosError(error) && error.response?.status === 429;
        const isTimeout = axios.isAxiosError(error) &&
          (error.code === 'ECONNABORTED' ||
           error.code === 'ETIMEDOUT' ||
           error.message?.includes('timeout'));

        const baseDelay = (isRateLimit || isTimeout) ? 5000 : 1000;
        const delay = baseDelay * Math.pow(2, attempt);

        let errorType = 'Request failed';
        if (isRateLimit) errorType = 'Rate limited';
        if (isTimeout) errorType = 'Request timed out';

        console.warn(`[LLM] ${errorType} (${entry.provider}/${entry.config.model}, attempt ${attempt + 1}/${maxRetries + 1}), retrying after ${delay}ms`);

        await this.delay(delay);
      }
    }

    let partialResponse: LLMResponse | null = null;

    if (axios.isAxiosError(lastError)) {
      const errorData = lastError.response?.data;
      if (errorData?.usage) {
        partialResponse = {
          content: '',
          finishReason: 'error',
          maxTokens: requestBody.max_tokens,
          usage: {
            promptTokens: errorData.usage.prompt_tokens ?? 0,
            completionTokens: errorData.usage.completion_tokens ?? 0,
            totalTokens: errorData.usage.total_tokens ?? 0
          }
        };
      } else {
        const estimatedPromptTokens = this.estimateTokens(messages);
        partialResponse = {
          content: '',
          finishReason: 'error',
          maxTokens: requestBody.max_tokens,
          usage: {
            promptTokens: estimatedPromptTokens,
            completionTokens: 0,
            totalTokens: estimatedPromptTokens
          }
        };
      }
    } else {
      const estimatedPromptTokens = this.estimateTokens(messages);
      partialResponse = {
        content: '',
        finishReason: 'error',
        maxTokens: requestBody.max_tokens,
        usage: {
          promptTokens: estimatedPromptTokens,
          completionTokens: 0,
          totalTokens: estimatedPromptTokens
        }
      };
    }

    this.logLlmUsage(entry, messages, partialResponse, lastError, {
      userId: userId ?? this.userId,
      sessionId,
      sessionType,
    });

    if (axios.isAxiosError(lastError)) {
      throw new Error(
        `LLM API Error: ${lastError.response?.data?.error?.message ?? lastError.message}`
      );
    }
    throw (lastError ?? new Error('Unknown LLM error'));
  }

  /**
   * Chat completion request with fallback across active configs
   */
  async chat(
    messages: LLMMessage[],
    options?: ChatOptions & { userId?: string }
  ): Promise<LLMResponse> {
    const errors: string[] = [];

    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index];
      try {
        const response = await this.chatWithEntry(entry, messages, options);
        this.lastSuccessfulEntryIndex = index;
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`[${entry.provider}/${entry.config.model}] ${errorMessage}`);

        if (index < this.entries.length - 1) {
          console.warn(`[LLM] Fallback to next config after failure: ${entry.provider}/${entry.config.model}`);
        }
      }
    }

    throw new Error(`All active LLM configs failed: ${errors.join(' | ')}`);
  }

  /**
   * Chat completion with JSON response
   */
  async chatJson<T>(messages: LLMMessage[]): Promise<T> {
    const jsonMessages: LLMMessage[] = [
      ...messages,
      {
        role: 'user',
        content: '\n\nIMPORTANT: Respond ONLY with a valid JSON object, no other text.'
      }
    ];

    const response = await this.chat(jsonMessages, { jsonMode: true });

    try {
      let content = response.content.trim();
      content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
      const jsonStr = this.extractJsonString(content);

      return JSON.parse(jsonStr) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse LLM JSON response: ${error}\n\nRaw response: ${response.content}`
      );
    }
  }

  private extractJsonString(content: string): string {
    const firstBrace = content.indexOf('{');
    if (firstBrace === -1) {
      return content;
    }

    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = firstBrace; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return content.substring(firstBrace, i + 1);
          }
        }
      }
    }

    return content.substring(firstBrace);
  }

  async complete(prompt: string): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await this.chat(messages);
    return response.content;
  }

  getModelName(): string {
    const entry = this.entries[this.lastSuccessfulEntryIndex] ?? this.entries[0];
    return entry.config.model;
  }

  getProviderName(): string {
    const entry = this.entries[this.lastSuccessfulEntryIndex] ?? this.entries[0];
    return entry.provider;
  }

  async healthCheckDetailed(): Promise<{ ok: boolean; error?: string }> {
    const entry = this.entries[this.lastSuccessfulEntryIndex] ?? this.entries[0];
    try {
      await this.chatWithEntry(
        entry,
        [{ role: 'user', content: 'ping' }],
        { temperature: 0, maxTokens: 8 }
      );
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.chat([{ role: 'user', content: 'ping' }]);
      return true;
    } catch {
      return false;
    }
  }
}

export const getLLMClient = (): LLMClient => {
  return getUserLLMClient('default-user');
};

export const getUserLLMClient = (userId?: string): LLMClient => {
  const resolvedUserId = userId ?? 'default-user';
  const configs = getDatabase()
    .listActiveUserLlmConfigs(resolvedUserId)
    .map(normalizeRuntimeLlmConfig)
    .filter((config): config is LLMConfig => config !== null);

  if (configs.length === 0) {
    throw new Error('No active LLM configuration found. Please add and activate at least one complete LLM config in settings.');
  }

  return new LLMClient(configs, { userId: resolvedUserId });
};
