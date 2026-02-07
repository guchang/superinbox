/**
 * LLM Client - Direct API Integration
 */

import axios, { type AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import type { LLMConfig } from '../types/index.js';
import { config } from '../config/index.js';
import { getDatabase } from '../storage/database.js';

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

export class LLMClient {
  private client: AxiosInstance;
  private config: LLMConfig;
  private provider: string;
  private userId?: string;

  constructor(llmConfig?: LLMConfig, options?: { userId?: string }) {
    this.config = llmConfig ?? config.llm;
    this.provider = this.config.provider || 'openai';
    this.userId = options?.userId;

    this.client = axios.create({
      baseURL: this.config.baseUrl ?? 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.timeout
    });
  }

  /**
   * Estimate token count from messages (fallback when API doesn't return usage)
   * Rough estimate: ~4 characters per token for English, more for Chinese
   */
  private estimateTokens(messages: LLMMessage[]): number {
    const text = messages.map(m => m.content).join(' ');
    // Conservative estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Log LLM usage asynchronously (non-blocking)
   */
  private logLlmUsage(
    messages: LLMMessage[],
    response: LLMResponse | null,
    error: Error | null,
    options?: {
      userId?: string;
      sessionId?: string;
      sessionType?: string;
    }
  ): void {
    // Use setImmediate to log asynchronously without blocking
    setImmediate(() => {
      try {
        const db = getDatabase();
        db.createLlmUsageLog({
          id: randomUUID(),
          userId: options?.userId ?? this.userId,
          model: this.config.model,
          provider: this.provider,
          requestMessages: JSON.stringify(messages),
          responseContent: response?.content ?? null,
          promptTokens: response?.usage?.promptTokens ?? 0,
          completionTokens: response?.usage?.completionTokens ?? 0,
          totalTokens: response?.usage?.totalTokens ?? 0,
          status: error ? 'error' : 'success',
          errorMessage: error?.message ?? null,
          sessionId: options?.sessionId ?? null,
          sessionType: options?.sessionType ?? null,
        });
      } catch (logError) {
        // Silently fail to not affect the main flow
        console.error('[LLM] Failed to log usage:', logError);
      }
    });
  }

  /**
   * Delay helper for retry mechanism
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const code = error.code;

      // Retry on:
      // - 429 (rate limit)
      // - 500, 502, 503, 504 (server errors)
      // - ECONNABORTED (timeout)
      // - ECONNRESET (connection reset)
      // - ETIMEDOUT (operation timed out)
      return status === 429 ||
             (status !== undefined && status >= 500 && status < 600) ||
             code === 'ECONNABORTED' ||
             code === 'ECONNRESET' ||
             code === 'ETIMEDOUT' ||
             error.message?.includes('timeout');
    }
    return false;
  }

  /**
   * Execute a single LLM API call (without retry logic)
   */
  private async executeChatRequest(
    requestBody: any,
    messages: LLMMessage[],
    chatOptions: any,
    userId?: string
  ): Promise<LLMResponse> {
    const response = await this.client.post('/chat/completions', requestBody);

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

    // Log successful request
    this.logLlmUsage(messages, result, null, {
      userId: userId ?? this.userId,
      sessionId: chatOptions?.sessionId,
      sessionType: chatOptions?.sessionType
    });

    return result;
  }

  /**
   * Chat completion request with exponential backoff retry
   */
  async chat(
    messages: LLMMessage[],
    options?: ChatOptions & { userId?: string }
  ): Promise<LLMResponse> {
    const { userId, ...chatOptions } = options ?? {};
    // Ensure every call has a session for statistics grouping.
    const sessionId = chatOptions?.sessionId ?? randomUUID();
    const sessionType = chatOptions?.sessionType ?? 'general';
    const normalizedChatOptions = { ...chatOptions, sessionId, sessionType };

    // Build request body outside try block so it's accessible in catch block
    const requestBody: any = {
      model: this.config.model,
      messages,
      temperature: chatOptions?.temperature ?? 0.3,
      max_tokens: chatOptions?.maxTokens ?? this.config.maxTokens ?? 2000
    };

    // Add JSON mode if supported and requested
    // Note: Some providers (like NVIDIA's OpenAI-compatible API) don't support response_format properly
    const baseUrl = this.config.baseUrl ?? '';
    const modelName = this.config.model ?? '';
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
        return await this.executeChatRequest(requestBody, messages, normalizedChatOptions, userId);
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          // Not retryable or max retries reached, fall through to error handling
          break;
        }

        const isRateLimit = axios.isAxiosError(error) && error.response?.status === 429;
        const isTimeout = axios.isAxiosError(error) &&
          (error.code === 'ECONNABORTED' ||
           error.code === 'ETIMEDOUT' ||
           error.message?.includes('timeout'));

        // Calculate delay: for 429/timeout use longer delays (5s, 10s, 20s), otherwise use exponential (1s, 2s, 4s)
        const baseDelay = (isRateLimit || isTimeout) ? 5000 : 1000;
        const delay = baseDelay * Math.pow(2, attempt);

        let errorType = 'Request failed';
        if (isRateLimit) errorType = 'Rate limited';
        if (isTimeout) errorType = 'Request timed out';

        console.warn(`[LLM] ${errorType} (attempt ${attempt + 1}/${maxRetries + 1}), retrying after ${delay}ms`);

        await this.delay(delay);
      }
    }

    // All retries exhausted or non-retryable error - handle error logging
    let partialResponse: LLMResponse | null = null;

    if (axios.isAxiosError(lastError)) {
      // Some LLM providers return usage info even in error responses
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
        // Fallback: estimate prompt tokens if API didn't return usage
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
      // Non-axios errors: still try to estimate
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

    // Log failed request with partial/estimated usage data
    this.logLlmUsage(messages, partialResponse, lastError, {
      userId: userId ?? this.userId,
      sessionId,
      sessionType,
    });

    if (axios.isAxiosError(lastError)) {
      throw new Error(
        `LLM API Error: ${lastError.response?.data?.error?.message ?? lastError.message}`
      );
    }
    throw lastError;
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

      // Remove <thinking>...</thinking> tags and their content (Claude thinking mode)
      content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

      // Use the smart JSON extraction method (same as used in parsePlannerOutput)
      const jsonStr = this.extractJsonString(content);

      return JSON.parse(jsonStr) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse LLM JSON response: ${error}\n\nRaw response: ${response.content}`
      );
    }
  }

  /**
   * Extract JSON string from content using bracket matching
   * (Same logic as used in rules.routes.ts parsePlannerOutput)
   */
  private extractJsonString(content: string): string {
    // Try to find a complete JSON object using bracket matching
    const firstBrace = content.indexOf('{');
    if (firstBrace === -1) {
      return content; // No JSON found
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
            // Found matching closing brace
            return content.substring(firstBrace, i + 1);
          }
        }
      }
    }

    // Fallback: return from first brace to end
    return content.substring(firstBrace);
  }

  /**
   * Simple completion request
   */
  async complete(prompt: string): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await this.chat(messages);
    return response.content;
  }

  getModelName(): string {
    return this.config.model;
  }

  getProviderName(): string {
    return this.provider;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.chat([{ role: 'user', content: 'ping' }]);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Default LLM client instance
 */
let llmInstance: LLMClient | null = null;

export const getLLMClient = (): LLMClient => {
  if (!llmInstance) {
    llmInstance = new LLMClient();
  }
  return llmInstance;
};

/**
 * Get LLM client with user-specific config
 */
export const getUserLLMClient = (userId?: string): LLMClient => {
  // Check if user has custom LLM config
  const userConfig = userId ? getDatabase().getUserLlmConfig(userId) : null;

  // If user has custom config, create client with it
  if (userConfig && userConfig.provider) {
    return new LLMClient(
      {
        provider: userConfig.provider,
        model: userConfig.model || config.llm.model,
        apiKey: userConfig.apiKey || config.llm.apiKey,
        baseUrl: userConfig.baseUrl || config.llm.baseUrl,
        timeout: userConfig.timeout || config.llm.timeout,
        maxTokens: userConfig.maxTokens || config.llm.maxTokens
      },
      { userId }
    );
  }

  // Use default client with userId for logging
  return new LLMClient(undefined, { userId });
};
