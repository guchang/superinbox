/**
 * Delete Command - Remove an item
 */

import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api/client.js';
import { display } from '../utils/display.js';
import { requireAuth } from '../utils/auth-check.js';
import { t } from '../utils/i18n.js';

export async function deleteItem(id?: string, returnToList: boolean = false): Promise<void> {
  try {
    await requireAuth();

    let targetId = id;

    // If no ID provided, ask user to select
    if (!targetId) {
      const items = await api.listItems({ limit: 20 });

      if (items.length === 0) {
        display.info(t('commands.delete.empty'));
        return;
      }

      const inquirer = (await import('inquirer')).default;
      const { selectedId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedId',
          message: t('commands.delete.selectItem'),
          choices: items.map(item => ({
            name: `${item.originalContent.substring(0, 60)}${item.originalContent.length > 60 ? '...' : ''} (${item.category})`,
            value: item.id,
          })),
        },
      ]);

      targetId = selectedId;
    }

    // Confirm deletion
    const spinner = ora('Loading item...').start();
    const item = await api.getItem(targetId!);
    spinner.stop();

    const inquirer = (await import('inquirer')).default;

    // Display item details
    console.log('');
    console.log(chalk.yellow('About to delete the following item:'));
    console.log(chalk.gray(`  Content: ${item.originalContent.substring(0, 100)}`));
    console.log(chalk.gray(`  Category: ${item.category}`));
    console.log(chalk.gray(`  Status: ${item.status}`));
    if (item.summary) {
      console.log(chalk.gray(`  Summary: ${item.summary}`));
    }
    console.log('');

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: t('commands.delete.confirm'),
        default: false,
      },
    ]);

    if (!confirmed) {
      display.info(t('commands.delete.cancelled'));
      return;
    }

    // Delete the item
    const deleteSpinner = ora(t('commands.delete.deleting')).start();
    await api.deleteItem(targetId!);
    deleteSpinner.succeed(chalk.green(t('commands.delete.success')));
    console.log('');

    // 如果设置了 returnToList 标志，返回列表
    if (returnToList && process.stdin.isTTY) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: t('commands.delete.selectAction'),
          choices: [
            { name: t('commands.delete.backToList'), value: 'list' },
            { name: t('commands.delete.continueDelete'), value: 'continue' },
            { name: t('commands.delete.exit'), value: 'exit' },
          ],
        },
      ]);

      switch (action) {
        case 'list':
          const { list } = await import('./list.js');
          await list();
          break;
        case 'continue':
          await deleteItem(undefined, returnToList);
          break;
        case 'exit':
          console.log(chalk.gray(t('commands.list.exiting')));
          break;
      }
      return;
    }

    // 询问是否继续删除
    if (process.stdin.isTTY) {
      const { continue: shouldContinue } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: t('commands.delete.continuePrompt'),
          default: false,
        },
      ]);

      if (shouldContinue) {
        await deleteItem(undefined, returnToList); // 递归调用，不带 ID
      }
    }

  } catch (error) {
    display.error(error instanceof Error ? error.message : 'Failed to delete item');
    process.exit(1);
  }
}
