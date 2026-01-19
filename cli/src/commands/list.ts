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

    const items = await api.listItems(options);

    if (items.length === 0) {
      display.info(t('commands.list.empty'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    } else {
      display.table(items, options.limit !== undefined && options.limit > 10);
    }

    console.log('');
    display.info(`${t('commands.list.total')}: ${items.length}`);

    // 交互式操作提示
    if (!process.stdin.isTTY && !options.json) {
      // 非交互模式，不提示
      return;
    }

    // 询问是否要查看详情或进行其他操作
    const inquirer = (await import('inquirer')).default;
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('commands.list.selectAction'),
        choices: [
          { name: t('commands.list.viewDetails'), value: 'show' },
          { name: t('commands.list.deleteItem'), value: 'delete' },
          { name: t('commands.list.refresh'), value: 'refresh' },
          { name: t('commands.list.exit'), value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'show':
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

      case 'delete':
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
        await deleteItem(deleteItemId, true); // 传递 true，删除后返回列表
        break;

      case 'refresh':
        console.log(chalk.gray(t('commands.list.refreshing')));
        await list(options);
        break;

      case 'exit':
        console.log(chalk.gray(t('commands.list.exiting')));
        break;
    }

  } catch (error) {
    if (error === 'EXIT') {
      return; // 用户主动退出
    }
    display.error(error instanceof Error ? error.message : 'Failed to list items');
    process.exit(1);
  }
}
