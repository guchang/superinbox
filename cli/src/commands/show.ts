/**
 * Show Command - Display item details
 */

import chalk from 'chalk';
import { api } from '../api/client.js';
import { display } from '../utils/display.js';
import { requireAuth } from '../utils/auth-check.js';
import { t } from '../utils/i18n.js';

export async function show(id?: string): Promise<void> {
  try {
    await requireAuth();

    let targetId = id;

    // If no ID provided, ask user to select
    if (!targetId) {
      const items = await api.listItems({ limit: 20 });

      if (items.length === 0) {
        display.info(t('commands.show.empty'));
        return;
      }

      const inquirer = (await import('inquirer')).default;
      const { selectedId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedId',
          message: t('commands.show.selectItem'),
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
        message: t('commands.show.selectAction'),
        choices: [
          { name: t('commands.show.edit'), value: 'edit' },
          { name: t('commands.show.delete'), value: 'delete' },
          { name: t('commands.show.backToList'), value: 'list' },
          { name: t('commands.show.exit'), value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'edit':
        console.log(chalk.yellow(t('commands.show.editInProgress')));
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
        console.log(chalk.gray(t('commands.list.exiting')));
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
