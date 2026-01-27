/**
 * Resolve effective LLM config for a user (fallback to app defaults)
 */

import type { LLMConfig } from '../types/index.js';
import { config as appConfig } from '../config/index.js';
import { getDatabase } from '../storage/database.js';

export const resolveLlmConfig = (userId?: string): LLMConfig => {
  if (!userId) {
    return appConfig.llm;
  }

  const db = getDatabase();
  const userConfig = db.getUserLlmConfig(userId);

  return {
    provider: userConfig.provider ?? appConfig.llm.provider,
    apiKey: userConfig.apiKey ?? appConfig.llm.apiKey,
    model: userConfig.model ?? appConfig.llm.model,
    baseUrl: userConfig.baseUrl ?? appConfig.llm.baseUrl,
    timeout: userConfig.timeout ?? appConfig.llm.timeout,
    maxTokens: userConfig.maxTokens ?? appConfig.llm.maxTokens
  };
};
