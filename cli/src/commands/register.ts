/**
 * Register Command - 引导用户到网页注册
 */

import chalk from 'chalk';
import { config } from '../config/manager.js';

export async function register(): Promise<void> {
  // Check if already logged in
  const { api } = await import('../api/client.js');
  if (api.isLoggedIn()) {
    const user = api.getCurrentUserFromCache();
    console.log(chalk.yellow(`已登录为: ${user?.username} (${user?.email})`));
    console.log(chalk.gray('如需注册新账户，请先退出登录: sinbox logout'));
    return;
  }

  // Get web app URL from API base URL
  const apiBaseUrl = config.get().api.baseUrl;
  const webUrl = apiBaseUrl.replace('/v1', '').replace(':3001', ':3000');

  console.log('');
  console.log(chalk.cyan('  SuperInbox 注册'));
  console.log('');
  console.log(chalk.gray('  请在浏览器中打开以下链接完成注册:'));
  console.log('');
  console.log(chalk.cyan(`  ${webUrl}/register`));
  console.log('');
  console.log(chalk.gray('  注册成功后，使用以下命令登录:'));
  console.log(chalk.white('    sinbox login <用户名>'));
  console.log('');
}
