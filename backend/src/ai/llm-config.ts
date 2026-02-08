/**
 * Resolve effective LLM config for a user (database only)
 */

import type { LLMConfig } from '../types/index.js';
import { getDatabase } from '../storage/database.js';

const DEFAULT_LLM_TIMEOUT = 30000;
const DEFAULT_LLM_MAX_TOKENS = 2000;

export const resolveLlmConfig = (userId?: string): LLMConfig => {
  const db = getDatabase();
  const activeConfigs = db.listActiveUserLlmConfigs(userId ?? 'default-user');

  for (const config of activeConfigs) {
    const provider = config.provider?.trim();
    const model = config.model?.trim();
    const apiKey = config.apiKey?.trim();

    if (!provider || !model || !apiKey) {
      continue;
    }

    const baseUrl = config.baseUrl?.trim();

    return {
      provider,
      apiKey,
      model,
      baseUrl: baseUrl && baseUrl.length > 0 ? baseUrl : undefined,
      timeout: config.timeout ?? DEFAULT_LLM_TIMEOUT,
      maxTokens: config.maxTokens ?? DEFAULT_LLM_MAX_TOKENS
    };
  }

  throw new Error('No active LLM configuration found. Please add and activate at least one complete LLM config in settings.');
};
