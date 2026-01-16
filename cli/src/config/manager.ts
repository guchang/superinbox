/**
 * Configuration Manager
 */

import Conf from 'conf';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import dotenv from 'dotenv';
import type { Config } from '../types/index.js';

// Load .env file if exists
const envPaths = [
  join(process.cwd(), '.env'),
  join(homedir(), '.superinbox', '.env'),
  join(homedir(), '.sinboxrc')
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const defaultConfig: Config = {
  api: {
    baseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000/v1',
    key: process.env.API_KEY ?? 'dev-key-change-this-in-production',
    timeout: parseInt(process.env.API_TIMEOUT ?? '30000')
  },
  defaults: {
    source: process.env.DEFAULT_SOURCE ?? 'cli',
    type: process.env.DEFAULT_TYPE ?? 'text'
  },
  display: {
    compact: false,
    color: true
  }
};

export class ConfigManager {
  private conf: Conf<Config>;

  constructor() {
    this.conf = new Conf<Config>({
      projectName: 'superinbox-cli',
      configName: 'config',
      defaults: defaultConfig
    });
  }

  get(): Config {
    return this.conf.store;
  }

  set(key: string, value: any): void {
    const keys = key.split('.');
    const current = this.conf.store as any;

    let target = current;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in target)) {
        target[keys[i]] = {};
      }
      target = target[keys[i]];
    }

    target[keys[keys.length - 1]] = value;
    this.conf.set(current);
  }

  getApiKey(): string {
    return this.conf.store.api.key;
  }

  getBaseUrl(): string {
    return this.conf.store.api.baseUrl;
  }

  reset(): void {
    this.conf.clear();
    this.conf.store = defaultConfig;
  }

  all(): Config {
    return this.conf.store;
  }

  delete(key: string): void {
    const keys = key.split('.');
    const current = this.conf.store as any;

    let target = current;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in target)) {
        return; // Key doesn't exist
      }
      target = target[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey in target) {
      delete target[lastKey];
      this.conf.set(current);
    }
  }
}

export const config = new ConfigManager();
