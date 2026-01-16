/**
 * List Command - Display items
 */

import chalk from 'chalk';
import { api } from '../api/client.js';
import { display } from '../utils/display.js';
import { requireAuth } from '../utils/auth-check.js';
import type { ListOptions } from '../types/index.js';

export async function list(options: ListOptions = {}): Promise<void> {
  try {
    await requireAuth();

    const items = await api.listItems(options);

    if (items.length === 0) {
      display.info('暂无条目');
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(items, null, 2));
    } else {
      display.table(items, options.limit !== undefined && options.limit > 10);
    }

    console.log('');
    display.info(`总计: ${items.length} 条`);

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
        message: '选择操作:',
        choices: [
          { name: '查看详情', value: 'show' },
          { name: '删除条目', value: 'delete' },
          { name: '刷新列表', value: 'refresh' },
          { name: '退出', value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'show':
        const { itemId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'itemId',
            message: '选择要查看的条目:',
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
            message: '选择要删除的条目:',
            choices: items.map(item => ({
              name: `${item.originalContent.substring(0, 50)}${item.originalContent.length > 50 ? '...' : ''} (${item.intent})`,
              value: item.id,
            })),
          },
        ]);
        const { deleteItem } = await import('./delete.js');
        await deleteItem(deleteItemId, true); // 传递 true，删除后返回列表
        break;

      case 'refresh':
        console.log(chalk.gray('刷新中...'));
        await list(options);
        break;

      case 'exit':
        console.log(chalk.gray('退出'));
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
