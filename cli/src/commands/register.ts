/**
 * Register Command - 引导用户到网页注册
 */

import chalk from 'chalk';
import { api } from '../api/client.js';
import { config } from '../config/manager.js';
import { t } from '../utils/i18n.js';

export async function register(): Promise<void> {
  // Check if already logged in with a usable session
  const session = await api.ensureSession();
  if (session.loggedIn) {
    const user = api.getCurrentUserFromCache();
    console.log(chalk.yellow(`${t('commands.register.alreadyLoggedIn')}: ${user?.username} (${user?.email})`));
    console.log(chalk.gray(t('commands.register.logoutFirst')));
    return;
  }

  // Get web app URL from API base URL
  const apiBaseUrl = config.get().api.baseUrl;
  const webUrl = apiBaseUrl.replace('/v1', '').replace(':3001', ':3000');

  console.log('');
  console.log(chalk.cyan(`  ${t('commands.register.title')}`));
  console.log('');
  console.log(chalk.gray(`  ${t('commands.register.instructions')}`));
  console.log('');
  console.log(chalk.cyan(`  ${webUrl}/register`));
  console.log('');
  console.log(chalk.gray(`  ${t('commands.register.afterRegister')}`));
  console.log(chalk.white(`    ${t('commands.register.loginCommand')}`));
  console.log('');
}
