/**
 * List Command - Display items
 */

import chalk from 'chalk';
import { api } from '../api/client.js';
import { display } from '../utils/display.js';
import { requireAuth } from '../utils/auth-check.js';
import { t } from '../utils/i18n.js';
import type { ListOptions } from '../types/index.js';

export async function list(options: ListOptions = {}): Promise<void> {
  try {
    await requireAuth();

    const normalizedOptions: ListOptions = {
      ...options,
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    };

    const result = await api.listItemsResult(normalizedOptions);
    const items = result.items;

    if (items.length === 0) {
      display.info(t('commands.list.empty'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }

    display.table(items, (normalizedOptions.limit ?? 20) > 10);

    const pageSize = Math.max(1, result.limit);
    const totalItems = Math.max(0, result.total);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(totalPages, Math.max(1, result.page));

    console.log('');
    display.info(`${t('commands.list.total')}: ${totalItems} | ${t('commands.list.pageInfo')}: ${currentPage}/${totalPages}`);

    // 交互式操作提示
    if (!process.stdin.isTTY && !options.json) {
      return;
    }

    const inquirer = (await import('inquirer')).default;
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('commands.list.selectAction'),
        choices: [
          { name: t('commands.list.viewDetails'), value: 'show' },
          { name: t('commands.list.deleteItem'), value: 'delete' },
          { name: t('commands.list.prevPage'), value: 'prev' },
          { name: t('commands.list.nextPage'), value: 'next' },
          { name: t('commands.list.gotoPage'), value: 'goto' },
          { name: t('commands.list.refresh'), value: 'refresh' },
          { name: t('commands.list.exit'), value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'show': {
        const { itemId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'itemId',
            message: t('commands.list.selectItem'),
            choices: items.map(item => ({
              name: `${item.originalContent.substring(0, 50)}${item.originalContent.length > 50 ? '...' : ''}`,
              value: item.id,
            })),
          },
        ]);
        const { show } = await import('./show.js');
        await show(itemId);
        break;
      }

      case 'delete': {
        const { deleteItemId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'deleteItemId',
            message: t('commands.list.selectToDelete'),
            choices: items.map(item => ({
              name: `${item.originalContent.substring(0, 50)}${item.originalContent.length > 50 ? '...' : ''} (${item.category})`,
              value: item.id,
            })),
          },
        ]);
        const { deleteItem } = await import('./delete.js');
        await deleteItem(deleteItemId, true);
        break;
      }

      case 'prev': {
        if (currentPage <= 1) {
          display.info(t('commands.list.noPrevPage'));
          break;
        }

        await list({
          ...normalizedOptions,
          limit: pageSize,
          offset: Math.max(0, result.offset - pageSize),
        });
        break;
      }

      case 'next': {
        if (currentPage >= totalPages) {
          display.info(t('commands.list.noNextPage'));
          break;
        }

        await list({
          ...normalizedOptions,
          limit: pageSize,
          offset: result.offset + pageSize,
        });
        break;
      }

      case 'goto': {
        const { pageInput } = await inquirer.prompt([
          {
            type: 'input',
            name: 'pageInput',
            message: t('commands.list.gotoPrompt'),
            validate: (input: string) => {
              const target = Number(input);
              const isValid = Number.isInteger(target) && target >= 1 && target <= totalPages;
              return isValid || `${t('commands.list.invalidPage')}: 1-${totalPages}`;
            },
          },
        ]);

        const targetPage = Number(pageInput);
        await list({
          ...normalizedOptions,
          limit: pageSize,
          offset: (targetPage - 1) * pageSize,
        });
        break;
      }

      case 'refresh':
        console.log(chalk.gray(t('commands.list.refreshing')));
        await list({
          ...normalizedOptions,
          limit: pageSize,
          offset: result.offset,
        });
        break;

      case 'exit':
        console.log(chalk.gray(t('commands.list.exiting')));
        break;
    }

  } catch (error) {
    if (error === 'EXIT') {
      return;
    }
    display.error(error instanceof Error ? error.message : 'Failed to list items');
    process.exit(1);
  }
}
