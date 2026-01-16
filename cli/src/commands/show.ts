/**
 * Show Command - Display item details
 */

import chalk from 'chalk';
import { api } from '../api/client.js';
import { display } from '../utils/display.js';
import { requireAuth } from '../utils/auth-check.js';

export async function show(id?: string): Promise<void> {
  try {
    await requireAuth();

    let targetId = id;

    // If no ID provided, ask user to select
    if (!targetId) {
      const items = await api.listItems({ limit: 20 });

      if (items.length === 0) {
        display.info('暂无条目');
        return;
      }

      const inquirer = (await import('inquirer')).default;
      const { selectedId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedId',
          message: '选择要查看的条目:',
          choices: items.map(item => ({
            name: `${item.originalContent.substring(0, 60)}${item.originalContent.length > 60 ? '...' : ''}`,
            value: item.id,
          })),
        },
      ]);

      targetId = selectedId;
    }

    const item = await api.getItem(targetId!);
    display.item(item);

    // 交互式操作提示
    if (!process.stdin.isTTY) {
      return; // 非交互模式
    }

    const inquirer = (await import('inquirer')).default;
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '选择操作:',
        choices: [
          { name: '编辑条目', value: 'edit' },
          { name: '删除条目', value: 'delete' },
          { name: '返回列表', value: 'list' },
          { name: '退出', value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'edit':
        console.log(chalk.yellow('编辑功能开发中...'));
        break;

      case 'delete':
        const { deleteItem } = await import('./delete.js');
        await deleteItem(targetId, true); // 传递 true，删除后返回列表
        break;

      case 'list':
        const { list } = await import('./list.js');
        await list();
        break;

      case 'exit':
        console.log(chalk.gray('退出'));
        break;
    }

  } catch (error) {
    if (error === 'EXIT') {
      return;
    }
    display.error(error instanceof Error ? error.message : 'Failed to get item');
    process.exit(1);
  }
}
