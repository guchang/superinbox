/**
 * Delete Command - Remove an item
 */

import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api/client.js';
import { display } from '../utils/display.js';
import { requireAuth } from '../utils/auth-check.js';

export async function deleteItem(id?: string, returnToList: boolean = false): Promise<void> {
  try {
    await requireAuth();

    let targetId = id;

    // If no ID provided, ask user to select
    if (!targetId) {
      const items = await api.listItems({ limit: 20 });

      if (items.length === 0) {
        display.info('暂无条目可删除');
        return;
      }

      const inquirer = (await import('inquirer')).default;
      const { selectedId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedId',
          message: '选择要删除的条目:',
          choices: items.map(item => ({
            name: `${item.originalContent.substring(0, 60)}${item.originalContent.length > 60 ? '...' : ''} (${item.intent})`,
            value: item.id,
          })),
        },
      ]);

      targetId = selectedId;
    }

    // Confirm deletion
    const spinner = ora('获取条目信息...').start();
    const item = await api.getItem(targetId!);
    spinner.stop();

    const inquirer = (await import('inquirer')).default;

    // 显示条目详情
    console.log('');
    console.log(chalk.yellow('即将删除以下条目:'));
    console.log(chalk.gray(`  内容: ${item.originalContent.substring(0, 100)}`));
    console.log(chalk.gray(`  意图: ${item.intent}`));
    console.log(chalk.gray(`  状态: ${item.status}`));
    if (item.summary) {
      console.log(chalk.gray(`  摘要: ${item.summary}`));
    }
    console.log('');

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: '确定要删除此条目吗?',
        default: false,
      },
    ]);

    if (!confirmed) {
      display.info('已取消删除');
      return;
    }

    // Delete the item
    const deleteSpinner = ora('删除中...').start();
    await api.deleteItem(targetId!);
    deleteSpinner.succeed(chalk.green('删除成功'));
    console.log('');

    // 如果设置了 returnToList 标志，返回列表
    if (returnToList && process.stdin.isTTY) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '选择操作:',
          choices: [
            { name: '返回列表', value: 'list' },
            { name: '继续删除', value: 'continue' },
            { name: '退出', value: 'exit' },
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
          console.log(chalk.gray('退出'));
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
          message: '是否继续删除其他条目?',
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
