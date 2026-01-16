/**
 * Delete Command - Remove an item
 */

import inquirer from 'inquirer';
import { api } from '../api/client.js';
import { display } from '../utils/display.js';

export async function deleteItem(id?: string): Promise<void> {
  try {
    let targetId = id;

    // If no ID provided, ask user to select
    if (!targetId) {
      const items = await api.listItems({ limit: 20 });

      if (items.length === 0) {
        display.info('No items to delete');
        return;
      }

      const { selectedId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedId',
          message: 'Select an item to delete:',
          choices: items.map(item => ({
            name: `${item.originalContent.substring(0, 50)}${item.originalContent.length > 50 ? '...' : ''} (${item.intent})`,
            value: item.id,
          })),
        },
      ]);

      targetId = selectedId;
    }

    // Confirm deletion
    const item = await api.getItem(targetId!);
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Are you sure you want to delete this item?\n  Content: ${item.originalContent.substring(0, 100)}\n  Intent: ${item.intent}`,
        default: false,
      },
    ]);

    if (!confirmed) {
      display.info('Deletion cancelled');
      return;
    }

    // Delete the item
    await api.deleteItem(targetId!);
    display.success('Item deleted successfully');

  } catch (error) {
    display.error(error instanceof Error ? error.message : 'Failed to delete item');
    process.exit(1);
  }
}
