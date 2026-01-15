/**
 * Config Command - Manage CLI configuration
 */

import { display } from '../utils/display.js';
import { config } from '../config/manager.js';

export async function configure(action: string, key?: string, value?: string): Promise<void> {
  switch (action) {
    case 'get':
      if (key) {
        const keys = key.split('.');
        const current = config.get() as any;
        let result = current;

        for (const k of keys) {
          if (result && k in result) {
            result = result[k];
          } else {
            display.error(`Config key "${key}" not found`);
            process.exit(1);
          }
        }

        console.log(JSON.stringify(result, null, 2));
      } else {
        display.config(config.get());
      }
      break;

    case 'set':
      if (!key || !value) {
        display.error('Usage: config set <key> <value>');
        process.exit(1);
      }

      try {
        const parsedValue = JSON.parse(value);
        config.set(key, parsedValue);
        display.success(`Set ${key} = ${parsedValue}`);
      } catch {
        config.set(key, value);
        display.success(`Set ${key} = ${value}`);
      }
      break;

    case 'reset':
      config.reset();
      display.success('Configuration reset to defaults');
      break;

    default:
      display.error(`Unknown config action: ${action}`);
      display.info('Available actions: get, set, reset');
      process.exit(1);
  }
}
