/**
 * Status Command - Check server status
 */

import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api/client.js';
import { config } from '../config/manager.js';
import { display } from '../utils/display.js';
import { t } from '../utils/i18n.js';

export async function status(): Promise<void> {
  const spinner = ora(t('commands.status.checking')).start();

  try {
    const health = await api.healthCheck();
    const session = await api.ensureSession();
    spinner.succeed(t('commands.status.running'));

    console.log('');
    console.log(chalk.gray(`${t('commands.status.version')}  `) + chalk.white(health.version));
    console.log(chalk.gray(`${t('commands.status.status')}   `) + chalk.green(health.status));
    console.log(chalk.gray(`${t('commands.status.endpoint')} `) + chalk.cyan(config.get().api.baseUrl));

    // Show login status
    if (session.loggedIn) {
      const user = api.getCurrentUserFromCache();
      console.log(chalk.gray(`${t('commands.status.user')}     `) + chalk.green(`${user?.username} (${user?.email})`));
    } else {
      console.log(chalk.gray(`${t('commands.status.user')}     `) + chalk.yellow(t('commands.status.notLoggedIn')));
    }

    console.log('');

  } catch (error) {
    spinner.fail(t('commands.status.failed'));
    display.error(error instanceof Error ? error.message : 'Cannot connect to server');
    process.exit(1);
  }
}
