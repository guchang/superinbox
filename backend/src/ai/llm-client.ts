/**
 * LLM Client - Direct API Integration
 */

import axios, { type AxiosInstance } from 'axios';
import type { LLMConfig } from '../types/index.js';
import { config } from '../config/index.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMClient {
  private client: AxiosInstance;
  private config: LLMConfig;

  constructor(llmConfig?: LLMConfig) {
    this.config = llmConfig ?? config.llm;

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
   * Chat completion request
   */
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages,
        temperature: 0.3,
        max_tokens: this.config.maxTokens
      });

      const choice = response.data.choices[0];
      return {
        content: choice.message.content,
        usage: {
          promptTokens: response.data.usage?.prompt_tokens ?? 0,
          completionTokens: response.data.usage?.completion_tokens ?? 0,
          totalTokens: response.data.usage?.total_tokens ?? 0
        }
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `LLM API Error: ${error.response?.data?.error?.message ?? error.message}`
        );
      }
      throw error;
    }
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

    const response = await this.chat(jsonMessages);

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        const lines = jsonStr.split('\n');
        lines.shift(); // Remove opening ```
        if (lines[0].startsWith('json')) {
          lines.shift(); // Remove 'json' if present
        }
        lines.pop(); // Remove closing ```
        jsonStr = lines.join('\n');
      }

      return JSON.parse(jsonStr) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse LLM JSON response: ${error}\n\nRaw response: ${response.content}`
      );
    }
  }

  /**
   * Simple completion request
   */
  async complete(prompt: string): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await this.chat(messages);
    return response.content;
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

// Singleton instance
let llmInstance: LLMClient | null = null;

export const getLLMClient = (): LLMClient => {
  if (!llmInstance) {
    llmInstance = new LLMClient();
  }
  return llmInstance;
};
