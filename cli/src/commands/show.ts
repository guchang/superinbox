/**
 * Show Command - Display item details
 */

import { api } from '../api/client.js';
import { display } from '../utils/display.js';

export async function show(id: string): Promise<void> {
  try {
    const item = await api.getItem(id);
    display.item(item);

  } catch (error) {
    display.error(error instanceof Error ? error.message : 'Failed to get item');
    process.exit(1);
  }
}
