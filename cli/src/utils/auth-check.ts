/**
 * Authentication check utility
 */

import chalk from 'chalk';
import { api } from '../api/client.js';

/**
 * Check if user is logged in, if not show login prompt and exit
 */
export async function requireAuth(): Promise<void> {
  if (!api.isLoggedIn()) {
    console.log('');
    console.log(chalk.yellow('  需要先登录才能使用此功能'));
    console.log('');
    console.log(chalk.gray('  请使用以下命令登录:'));
    console.log(chalk.white('    sinbox login'));
    console.log('');
    process.exit(1);
  }
}
