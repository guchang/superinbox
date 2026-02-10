/**
 * Authentication check utility
 */

import chalk from 'chalk';
import { api } from '../api/client.js';
import { t } from './i18n.js';

/**
 * Check if user is logged in, if not show login prompt and exit
 */
export async function requireAuth(): Promise<void> {
  const session = await api.ensureSession();
  if (!session.loggedIn) {
    console.log('');
    console.log(chalk.yellow(`  ${t('commands.auth.required')}`));
    console.log('');
    console.log(chalk.gray(`  ${t('commands.auth.loginPrompt')}`));
    console.log(chalk.white('    sinbox login'));
    console.log('');
    process.exit(1);
  }
}
