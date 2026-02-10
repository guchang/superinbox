/**
 * Logout Command
 */

import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api/client.js';
import { t, getLanguage } from '../utils/i18n.js';
import { display } from '../utils/display.js';

export async function logout() {
  // Check if login-related cache exists
  if (!api.hasAuthCache()) {
    console.log(chalk.yellow(getLanguage() === 'zh' ? '未登录，无需退出' : 'Not logged in'));
    return;
  }

  const user = api.getCurrentUserFromCache();
  const username = user?.username || (getLanguage() === 'zh' ? '当前账户' : 'current account');

  // Confirm logout
  const inquirer = (await import('inquirer')).default;
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `${t('commands.logout.confirm')} (${username})`,
      default: false
    }
  ]);

  if (!confirm) {
    display.info(t('config.common.cancelled'));
    return;
  }

  const spinner = ora(t('commands.logout.loggingOut')).start();

  try {
    await api.logout();

    spinner.succeed(chalk.green(t('commands.logout.success')));
    console.log('');

  } catch (error) {
    spinner.fail(chalk.red(t('commands.logout.failed')));
    if (error instanceof Error) {
      console.log(chalk.red(error.message));
    }
    process.exit(1);
  }
}
