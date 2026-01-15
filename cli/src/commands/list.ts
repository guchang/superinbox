/**
 * List Command - Display items
 */

import { api } from '../api/client.js';
import { display } from '../utils/display.js';
import type { ListOptions } from '../types/index.js';

export async function list(options: ListOptions = {}): Promise<void> {
  try {
    const items = await api.listItems(options);

    if (options.json) {
      console.log(JSON.stringify(items, null, 2));
    } else {
      display.table(items, options.limit !== undefined && options.limit > 10);
    }

    console.log('');
    display.info(`Total: ${items.length} item(s)`);

  } catch (error) {
    display.error(error instanceof Error ? error.message : 'Failed to list items');
    process.exit(1);
  }
}
