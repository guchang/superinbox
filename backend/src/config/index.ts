/**
 * Configuration Management
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import type { AppConfig } from '../types';

// Load environment variables
dotenv.config();

// Configuration Schema
const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // API
  API_KEY_PREFIX: z.string().default('sinbox'),
  DEFAULT_API_KEY: z.string().default('dev-key-change-this-in-production'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Database
  DATABASE_PATH: z.string().default('./data/superinbox.db'),

  // LLM
  LLM_PROVIDER: z.string().default('openai'),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_MODEL: z.string().default('gpt-4'),
  LLM_BASE_URL: z.string().optional(),
  LLM_TIMEOUT: z.string().transform(Number).default('30000'),
  LLM_MAX_TOKENS: z.string().transform(Number).default('2000'),

  // Storage
  UPLOAD_DIR: z.string().default('./data/uploads'),
  MAX_UPLOAD_SIZE: z.string().transform(Number).default('10485760'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Security
  JWT_SECRET: z.string().default('your-jwt-secret-change-this-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().default('your-32-character-encryption-key')
});

// Validate and parse configuration
const validateConfig = (): AppConfig => {
  try {
    const env = configSchema.parse(process.env);

    return {
      server: {
        port: env.PORT,
        host: env.HOST,
        nodeEnv: env.NODE_ENV
      },
      database: {
        path: env.DATABASE_PATH
      },
      llm: {
        provider: env.LLM_PROVIDER,
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL,
        baseUrl: env.LLM_BASE_URL,
        timeout: env.LLM_TIMEOUT,
        maxTokens: env.LLM_MAX_TOKENS
      },
      api: {
        keyPrefix: env.API_KEY_PREFIX,
        defaultKey: env.DEFAULT_API_KEY
      },
      rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        maxRequests: env.RATE_LIMIT_MAX_REQUESTS
      },
      cors: {
        origin: env.CORS_ORIGIN
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => `${e.path.join('.')} (${e.message})`);
      throw new Error(`Configuration validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
};

// Export singleton configuration
export const config = validateConfig();

// Helper to get config by key
export const get = <K extends keyof AppConfig>(key: K): AppConfig[K] => {
  return config[key];
};

// Helper to check environment
export const isDevelopment = (): boolean => config.server.nodeEnv === 'development';
export const isProduction = (): boolean => config.server.nodeEnv === 'production';
export const isTest = (): boolean => config.server.nodeEnv === 'test';
