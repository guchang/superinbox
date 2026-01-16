/**
 * Logout Command
 */

import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api/client.js';

export async function logout() {
  // Check if logged in
  if (!api.isLoggedIn()) {
    console.log(chalk.yellow('未登录，无需退出'));
    return;
  }

  const user = api.getCurrentUserFromCache();

  // Confirm logout
  const inquirer = (await import('inquirer')).default;
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `确定要退出登录吗? (${user?.username})`,
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.gray('已取消'));
    return;
  }

  const spinner = ora('退出登录中...').start();

  try {
    await api.logout();

    spinner.succeed(chalk.green('已退出登录'));
    console.log('');

  } catch (error) {
    spinner.fail(chalk.red('退出登录失败'));
    if (error instanceof Error) {
      console.log(chalk.red(error.message));
    }
    process.exit(1);
  }
}
